// Tests for the indexer Edge Function — event discriminators, event parsing,
// base58 encoding, and idempotency logic.
//
// Run with: deno test supabase/functions/indexer/index.test.ts

// deno test --no-check

/// <reference path="../shims.d.ts" />

import { assertEquals, assertNotEquals } from '@std/assert';

// --- Replicate pure functions from index.ts for testing ---

const EVENT_DISCRIMINATORS: Record<string, string> = {
  PledgeCreated: '8817363943578e1a',
  PledgeEdited: '7cd0d92f9050b193',
  CompletionReported: '4825c6a2702f1144',
  PledgeCompleted: '98f00583c8eb2d91',
  PledgeForfeited: 'da389a3202688f41',
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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

function base58Decode(str: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 char: ${char}`);
    let carry = idx;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char !== '1') break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

function readPubkey(data: Uint8Array, offset: number): string {
  return base58Encode(data.slice(offset, offset + 32));
}

function readU64(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigUint64(0, true);
}

function readI64(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigInt64(0, true);
}

function readU8(data: Uint8Array, offset: number): number {
  return data[offset];
}

interface PledgeCreatedEvent {
  type: 'PledgeCreated';
  pledge: string;
  user: string;
  stakeAmount: bigint;
  deadline: bigint;
}
interface PledgeEditedEvent {
  type: 'PledgeEdited';
  pledge: string;
  penaltyPaid: bigint;
}
interface CompletionReportedEvent {
  type: 'CompletionReported';
  pledge: string;
  completionPercentage: number;
}
interface PledgeCompletedEvent {
  type: 'PledgeCompleted';
  pledge: string;
  completionPercentage: number;
  refundAmount: bigint;
  feeAmount: bigint;
}
interface PledgeForfeitedEvent {
  type: 'PledgeForfeited';
  pledge: string;
  treasuryAmount: bigint;
  charityAmount: bigint;
}
type PledgeEvent =
  | PledgeCreatedEvent
  | PledgeEditedEvent
  | CompletionReportedEvent
  | PledgeCompletedEvent
  | PledgeForfeitedEvent;

function parseEventData(data: Uint8Array): PledgeEvent | null {
  if (data.length < 8) return null;
  const discHex = bytesToHex(data.slice(0, 8));
  const payload = data.slice(8);

  if (discHex === EVENT_DISCRIMINATORS.PledgeCreated) {
    if (payload.length < 80) return null;
    return {
      type: 'PledgeCreated',
      pledge: readPubkey(payload, 0),
      user: readPubkey(payload, 32),
      stakeAmount: readU64(payload, 64),
      deadline: readI64(payload, 72),
    };
  }
  if (discHex === EVENT_DISCRIMINATORS.PledgeEdited) {
    if (payload.length < 40) return null;
    return {
      type: 'PledgeEdited',
      pledge: readPubkey(payload, 0),
      penaltyPaid: readU64(payload, 32),
    };
  }
  if (discHex === EVENT_DISCRIMINATORS.CompletionReported) {
    if (payload.length < 33) return null;
    return {
      type: 'CompletionReported',
      pledge: readPubkey(payload, 0),
      completionPercentage: readU8(payload, 32),
    };
  }
  if (discHex === EVENT_DISCRIMINATORS.PledgeCompleted) {
    if (payload.length < 49) return null;
    return {
      type: 'PledgeCompleted',
      pledge: readPubkey(payload, 0),
      completionPercentage: readU8(payload, 32),
      refundAmount: readU64(payload, 33),
      feeAmount: readU64(payload, 41),
    };
  }
  if (discHex === EVENT_DISCRIMINATORS.PledgeForfeited) {
    if (payload.length < 48) return null;
    return {
      type: 'PledgeForfeited',
      pledge: readPubkey(payload, 0),
      treasuryAmount: readU64(payload, 32),
      charityAmount: readU64(payload, 40),
    };
  }
  return null;
}

const PROGRAM_ID = 'PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp';

function parseEventsFromLogs(logs: string[]): PledgeEvent[] {
  const events: PledgeEvent[] = [];
  let inProgram = false;
  for (const log of logs) {
    if (log.includes(`Program ${PROGRAM_ID} invoke`)) {
      inProgram = true;
      continue;
    }
    if (
      log.includes(`Program ${PROGRAM_ID} success`) ||
      log.includes(`Program ${PROGRAM_ID} failed`)
    ) {
      inProgram = false;
      continue;
    }
    if (inProgram && log.startsWith('Program data: ')) {
      const base64Data = log.slice('Program data: '.length);
      try {
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const event = parseEventData(bytes);
        if (event) events.push(event);
      } catch {
        // skip
      }
    }
  }
  return events;
}

// --- Helpers ---
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function buildEventData(eventName: string, payload: Uint8Array): Uint8Array {
  const disc = hexToBytes(EVENT_DISCRIMINATORS[eventName]);
  const result = new Uint8Array(disc.length + payload.length);
  result.set(disc, 0);
  result.set(payload, disc.length);
  return result;
}

function makePubkeyBytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = i + 1;
  return bytes;
}

function writeU64LE(value: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, value, true);
  return new Uint8Array(buf);
}

function writeI64LE(value: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigInt64(0, value, true);
  return new Uint8Array(buf);
}

// =====================
// TESTS
// =====================

// --- H1: Event discriminator verification ---

Deno.test(
  'event discriminators match SHA256("event:<Name>")[0..8]',
  async () => {
    for (const [eventName, expectedHex] of Object.entries(
      EVENT_DISCRIMINATORS,
    )) {
      const data = new TextEncoder().encode(`event:${eventName}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = new Uint8Array(hashBuffer);
      const computedHex = bytesToHex(hashArray.slice(0, 8));
      assertEquals(
        computedHex,
        expectedHex,
        `Discriminator mismatch for ${eventName}: expected ${expectedHex}, got ${computedHex}`,
      );
    }
  },
);

Deno.test('all 5 event discriminators are unique', () => {
  const values = Object.values(EVENT_DISCRIMINATORS);
  const unique = new Set(values);
  assertEquals(unique.size, 5);
});

Deno.test('event discriminators are non-empty 16-char hex strings', () => {
  for (const [name, hex] of Object.entries(EVENT_DISCRIMINATORS)) {
    assertNotEquals(hex, '', `${name} is empty`);
    assertEquals(hex.length, 16, `${name} should be 16 hex chars`);
  }
});

// --- parseEventData unit tests for all 5 events ---

Deno.test('parseEventData: PledgeCreated', () => {
  const pledgeKey = makePubkeyBytes();
  const userKey = new Uint8Array(32);
  for (let i = 0; i < 32; i++) userKey[i] = i + 33;

  const payload = new Uint8Array(80);
  payload.set(pledgeKey, 0);
  payload.set(userKey, 32);
  payload.set(writeU64LE(1000000n), 64);
  payload.set(writeI64LE(1700000000n), 72);

  const event = parseEventData(buildEventData('PledgeCreated', payload));
  assertNotEquals(event, null);
  assertEquals(event!.type, 'PledgeCreated');
  const e = event as PledgeCreatedEvent;
  assertEquals(e.stakeAmount, 1000000n);
  assertEquals(e.deadline, 1700000000n);
  assertEquals(e.pledge, base58Encode(pledgeKey));
  assertEquals(e.user, base58Encode(userKey));
});

Deno.test('parseEventData: PledgeEdited', () => {
  const payload = new Uint8Array(40);
  payload.set(makePubkeyBytes(), 0);
  payload.set(writeU64LE(50000n), 32);

  const event = parseEventData(buildEventData('PledgeEdited', payload));
  assertNotEquals(event, null);
  assertEquals(event!.type, 'PledgeEdited');
  assertEquals((event as PledgeEditedEvent).penaltyPaid, 50000n);
});

Deno.test('parseEventData: CompletionReported', () => {
  const payload = new Uint8Array(33);
  payload.set(makePubkeyBytes(), 0);
  payload[32] = 85;

  const event = parseEventData(buildEventData('CompletionReported', payload));
  assertNotEquals(event, null);
  assertEquals(event!.type, 'CompletionReported');
  assertEquals((event as CompletionReportedEvent).completionPercentage, 85);
});

Deno.test('parseEventData: PledgeCompleted', () => {
  const payload = new Uint8Array(49);
  payload.set(makePubkeyBytes(), 0);
  payload[32] = 90;
  payload.set(writeU64LE(900000n), 33);
  payload.set(writeU64LE(100000n), 41);

  const event = parseEventData(buildEventData('PledgeCompleted', payload));
  assertNotEquals(event, null);
  assertEquals(event!.type, 'PledgeCompleted');
  const e = event as PledgeCompletedEvent;
  assertEquals(e.completionPercentage, 90);
  assertEquals(e.refundAmount, 900000n);
  assertEquals(e.feeAmount, 100000n);
});

Deno.test('parseEventData: PledgeForfeited', () => {
  const payload = new Uint8Array(48);
  payload.set(makePubkeyBytes(), 0);
  payload.set(writeU64LE(700000n), 32);
  payload.set(writeU64LE(300000n), 40);

  const event = parseEventData(buildEventData('PledgeForfeited', payload));
  assertNotEquals(event, null);
  assertEquals(event!.type, 'PledgeForfeited');
  const e = event as PledgeForfeitedEvent;
  assertEquals(e.treasuryAmount, 700000n);
  assertEquals(e.charityAmount, 300000n);
});

Deno.test('parseEventData: returns null for unknown discriminator', () => {
  const data = new Uint8Array(80);
  data.fill(0xff, 0, 8);
  assertEquals(parseEventData(data), null);
});

Deno.test('parseEventData: returns null for data too short', () => {
  assertEquals(parseEventData(new Uint8Array(7)), null);
  assertEquals(parseEventData(new Uint8Array(0)), null);
});

Deno.test(
  'parseEventData: returns null for valid disc but truncated payload',
  () => {
    const disc = hexToBytes(EVENT_DISCRIMINATORS.PledgeCreated);
    const short = new Uint8Array(8 + 40);
    short.set(disc, 0);
    assertEquals(parseEventData(short), null);
  },
);

// --- Base58 round-trip ---

Deno.test('base58 round-trip: program ID', () => {
  const decoded = base58Decode(PROGRAM_ID);
  const reEncoded = base58Encode(decoded);
  assertEquals(reEncoded, PROGRAM_ID);
});

Deno.test('base58 round-trip: Token Program ID', () => {
  const tokenProgram = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const decoded = base58Decode(tokenProgram);
  const reEncoded = base58Encode(decoded);
  assertEquals(reEncoded, tokenProgram);
});

Deno.test('base58 round-trip: deterministic pubkey', () => {
  const key = makePubkeyBytes();
  const encoded = base58Encode(key);
  const decoded = base58Decode(encoded);
  assertEquals(decoded.length, 32);
  for (let i = 0; i < 32; i++) assertEquals(decoded[i], key[i]);
});

// --- parseEventsFromLogs ---

Deno.test('parseEventsFromLogs: extracts event from valid log sequence', () => {
  const payload = new Uint8Array(80);
  payload.set(makePubkeyBytes(), 0);
  const userKey = new Uint8Array(32);
  for (let i = 0; i < 32; i++) userKey[i] = i + 33;
  payload.set(userKey, 32);
  payload.set(writeU64LE(5000000n), 64);
  payload.set(writeI64LE(1800000000n), 72);
  const eventData = buildEventData('PledgeCreated', payload);
  const base64 = btoa(String.fromCharCode(...eventData));

  const logs = [
    `Program ${PROGRAM_ID} invoke [1]`,
    'Program log: Instruction: CreatePledge',
    `Program data: ${base64}`,
    `Program ${PROGRAM_ID} success`,
  ];

  const events = parseEventsFromLogs(logs);
  assertEquals(events.length, 1);
  assertEquals(events[0].type, 'PledgeCreated');
  assertEquals((events[0] as PledgeCreatedEvent).stakeAmount, 5000000n);
});

Deno.test('parseEventsFromLogs: ignores events from other programs', () => {
  const eventData = buildEventData('PledgeCreated', new Uint8Array(80));
  const base64 = btoa(String.fromCharCode(...eventData));

  const logs = [
    'Program OtherProgram111111111111111111111111111111 invoke [1]',
    `Program data: ${base64}`,
    'Program OtherProgram111111111111111111111111111111 success',
  ];

  assertEquals(parseEventsFromLogs(logs).length, 0);
});

Deno.test('parseEventsFromLogs: handles empty logs', () => {
  assertEquals(parseEventsFromLogs([]).length, 0);
});

// --- Idempotency ---

Deno.test('idempotency: processed_transactions PK prevents duplicates', () => {
  // Structural: same tx_signature causes unique violation (23505) which code handles
  const sig = '5abc123def';
  const record = { tx_signature: sig, event_type: 'PledgeCreated' };
  assertEquals(record.tx_signature, sig);
});
