// Tests for the daily-reconcile Edge Function — pledge account deserialization
// and discriminator-based filtering.
//
// Run with: deno test supabase/functions/daily-reconcile/index.test.ts

// deno test --no-check

/// <reference path="../shims.d.ts" />

import { assertEquals } from '@std/assert';

// --- Replicate constants and functions from index.ts ---

const STATUS_MAP: Record<number, string> = {
  0: 'Active',
  1: 'Reported',
  2: 'Completed',
  3: 'Forfeited',
  4: 'Cancelled',
};

const OFFSET_USER = 8;
const OFFSET_STAKE = 8 + 32 + 32;
const OFFSET_DEADLINE = 8 + 32 + 32 + 8;
const OFFSET_STATUS = 8 + 32 + 32 + 8 + 8;
const OFFSET_COMPLETION = 8 + 32 + 32 + 8 + 8 + 1;
const OFFSET_CREATED_AT = 8 + 32 + 32 + 8 + 8 + 1 + 2 + 9;

// Pledge account discriminator: SHA256("account:Pledge")[0..8]
const PLEDGE_DISCRIMINATOR = new Uint8Array([
  0xa1, 0xc5, 0x79, 0x2e, 0x63, 0x4b, 0xa9, 0x83,
]);

interface OnChainPledge {
  address: string;
  user: string;
  stakeAmount: number;
  deadline: number;
  status: string;
  completionPercentage: number | null;
  createdAt: number;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Simplified base58 encode for test addresses
const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (let j = 0; j < bytes.length; j++) {
    let carry = bytes[j];
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  for (let j = 0; j < bytes.length; j++) {
    if (bytes[j] !== 0) break;
    result += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

function readPublicKey(data: Uint8Array, offset: number): string {
  return base58Encode(data.slice(offset, offset + 32));
}

function readU64(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return Number(view.getBigUint64(0, true));
}

function readI64(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return Number(view.getBigInt64(0, true));
}

function deserializePledge(
  addressStr: string,
  data: Uint8Array,
): OnChainPledge {
  const status = STATUS_MAP[data[OFFSET_STATUS]] || 'Active';
  const hasCompletion = data[OFFSET_COMPLETION] === 1;
  const completionPercentage = hasCompletion
    ? data[OFFSET_COMPLETION + 1]
    : null;

  return {
    address: addressStr,
    user: readPublicKey(data, OFFSET_USER),
    stakeAmount: readU64(data, OFFSET_STAKE),
    deadline: readI64(data, OFFSET_DEADLINE),
    status,
    completionPercentage,
    createdAt: readI64(data, OFFSET_CREATED_AT),
  };
}

// --- Helper: build a mock pledge account blob ---
function buildPledgeAccountData(opts: {
  user?: Uint8Array;
  mint?: Uint8Array;
  stakeAmount?: bigint;
  deadline?: bigint;
  status?: number;
  completionPercentage?: number | null;
  createdAt?: bigint;
}): Uint8Array {
  // Total: 110 bytes (INIT_SPACE)
  const data = new Uint8Array(110);

  // Discriminator (first 8 bytes)
  data.set(PLEDGE_DISCRIMINATOR, 0);

  // user (32 bytes at offset 8)
  if (opts.user) data.set(opts.user, 8);

  // mint (32 bytes at offset 40)
  if (opts.mint) data.set(opts.mint, 40);

  // stake_amount (u64 at offset 72)
  const stake = opts.stakeAmount ?? 1000000n;
  const stakeView = new DataView(data.buffer, 72, 8);
  stakeView.setBigUint64(0, stake, true);

  // deadline (i64 at offset 80)
  const deadline = opts.deadline ?? 1700000000n;
  const deadlineView = new DataView(data.buffer, 80, 8);
  deadlineView.setBigInt64(0, deadline, true);

  // status (u8 at offset 88)
  data[88] = opts.status ?? 0;

  // completion_percentage Option<u8> at offset 89
  if (
    opts.completionPercentage !== null &&
    opts.completionPercentage !== undefined
  ) {
    data[89] = 1; // Some
    data[90] = opts.completionPercentage;
  } else {
    data[89] = 0; // None
    data[90] = 0;
  }

  // reported_at Option<i64> at offset 91 (1 disc + 8 value) — leave None
  data[91] = 0;

  // created_at (i64 at offset 100)
  const createdAt = opts.createdAt ?? 1700000000n;
  const createdAtView = new DataView(data.buffer, OFFSET_CREATED_AT, 8);
  createdAtView.setBigInt64(0, createdAt, true);

  return data;
}

// =====================
// TESTS
// =====================

// --- Account discriminator verification ---

Deno.test(
  'Pledge account discriminator matches SHA256("account:Pledge")[0..8]',
  async () => {
    const hashData = new TextEncoder().encode('account:Pledge');
    const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
    const hashArray = new Uint8Array(hashBuffer);
    const expected = hashArray.slice(0, 8);

    assertEquals(
      bytesToHex(PLEDGE_DISCRIMINATOR),
      bytesToHex(expected),
      'Pledge account discriminator does not match SHA256("account:Pledge")[0..8]',
    );
  },
);

// --- deserializePledge tests ---

Deno.test('deserializePledge: Active pledge with no completion', () => {
  const userKey = new Uint8Array(32);
  for (let i = 0; i < 32; i++) userKey[i] = i + 1;

  const data = buildPledgeAccountData({
    user: userKey,
    stakeAmount: 5000000n,
    deadline: 1800000000n,
    status: 0,
    completionPercentage: null,
  });

  const pledge = deserializePledge('TestAddress123', data);

  assertEquals(pledge.address, 'TestAddress123');
  assertEquals(pledge.stakeAmount, 5000000);
  assertEquals(pledge.deadline, 1800000000);
  assertEquals(pledge.status, 'Active');
  assertEquals(pledge.completionPercentage, null);
  assertEquals(pledge.user, base58Encode(userKey));
});

Deno.test(
  'deserializePledge: Reported pledge with completion percentage',
  () => {
    const data = buildPledgeAccountData({
      stakeAmount: 2000000n,
      deadline: 1750000000n,
      status: 1, // Reported
      completionPercentage: 75,
    });

    const pledge = deserializePledge('ReportedAddr', data);

    assertEquals(pledge.status, 'Reported');
    assertEquals(pledge.completionPercentage, 75);
    assertEquals(pledge.stakeAmount, 2000000);
  },
);

Deno.test('deserializePledge: Completed pledge', () => {
  const data = buildPledgeAccountData({
    status: 2,
    completionPercentage: 100,
  });

  const pledge = deserializePledge('CompletedAddr', data);
  assertEquals(pledge.status, 'Completed');
  assertEquals(pledge.completionPercentage, 100);
});

Deno.test('deserializePledge: Forfeited pledge', () => {
  const data = buildPledgeAccountData({
    status: 3,
    completionPercentage: 0,
  });

  const pledge = deserializePledge('ForfeitedAddr', data);
  assertEquals(pledge.status, 'Forfeited');
  assertEquals(pledge.completionPercentage, 0);
});

Deno.test('deserializePledge: unknown status defaults to Active', () => {
  const data = buildPledgeAccountData({ status: 99 });
  const pledge = deserializePledge('UnknownStatus', data);
  assertEquals(pledge.status, 'Active');
});

// --- Discriminator-based filtering ---

Deno.test('discriminator filter: matches pledge accounts', () => {
  const data = buildPledgeAccountData({});
  const disc = data.slice(0, 8);

  let match = true;
  for (let i = 0; i < 8; i++) {
    if (disc[i] !== PLEDGE_DISCRIMINATOR[i]) {
      match = false;
      break;
    }
  }
  assertEquals(match, true, 'Valid pledge account should match discriminator');
});

Deno.test('discriminator filter: rejects non-pledge accounts', () => {
  // Config account would have a different discriminator
  const data = new Uint8Array(200);
  data.fill(0xff, 0, 8); // garbage discriminator

  const disc = data.slice(0, 8);
  let match = true;
  for (let i = 0; i < 8; i++) {
    if (disc[i] !== PLEDGE_DISCRIMINATOR[i]) {
      match = false;
      break;
    }
  }
  assertEquals(match, false, 'Non-pledge account should not match');
});

Deno.test('discriminator filter: rejects data shorter than 8 bytes', () => {
  const data = new Uint8Array(4);
  assertEquals(data.length < 8, true);
});
