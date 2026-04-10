// TypeScript shim declarations for Supabase Edge Functions (Deno runtime).
// These files are executed by Deno, but our workspace TypeScript tooling
// doesn't understand the Deno global namespace by default.

// std/ resolves via deno.json import map to https://deno.land/std@0.168.0/
declare module 'std/http/server.ts' {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  test(name: string, fn: () => void | Promise<void>): void;
  test(options: { name: string; fn: () => void | Promise<void> }): void;
};

// Module declarations for npm: imports used via deno.json import maps
declare module '@supabase/supabase-js' {
  export const createClient: (
    url: string,
    key: string,
    options?: unknown
  ) => any;
}

declare module '@noble/ed25519' {
  export const verify: (
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array
  ) => boolean;
  export const etc: {
    sha512Sync: ((...m: Uint8Array[]) => Uint8Array) | undefined;
    concatBytes: (...arrays: Uint8Array[]) => Uint8Array;
  };
}

declare module '@noble/hashes/sha512' {
  export const sha512: (data: Uint8Array) => Uint8Array;
}

declare module 'bs58' {
  const bs58: {
    encode(data: Uint8Array): string;
    decode(data: string): Uint8Array;
  };
  export default bs58;
}

declare module 'jose' {
  export class SignJWT {
    constructor(payload: Record<string, unknown>);
    setProtectedHeader(header: Record<string, string>): this;
    setIssuer(issuer: string): this;
    setIssuedAt(): this;
    setExpirationTime(time: string): this;
    sign(secret: Uint8Array): Promise<string>;
  }
}

// JSR import for edge runtime types
declare module 'jsr:@supabase/functions-js/edge-runtime.d.ts' {}

// Test assertion module (jsr:@std/assert)
declare module '@std/assert' {
  export function assertEquals(actual: unknown, expected: unknown, msg?: string): void;
  export function assertNotEquals(actual: unknown, expected: unknown, msg?: string): void;
  export function assertExists(actual: unknown, msg?: string): void;
  export function assertThrows(fn: () => void, msg?: string): void;
}

// Solana web3.js types used by Edge Functions (process-crank, daily-reconcile)
declare module '@solana/web3.js' {
  export class Connection {
    constructor(endpoint: string, commitment?: string);
    getAccountInfo(
      publicKey: PublicKey,
      commitment?: string
    ): Promise<{ data: Uint8Array; lamports: number } | null>;
    getLatestBlockhash(
      commitment?: string
    ): Promise<{ blockhash: string; lastValidBlockHeight: number }>;
    getProgramAccounts(
      programId: PublicKey,
      config?: { commitment?: string }
    ): Promise<Array<{ pubkey: PublicKey; account: { data: Uint8Array; lamports: number } }>>;
    sendRawTransaction(
      rawTransaction: Uint8Array | Buffer,
      options?: { skipPreflight?: boolean; preflightCommitment?: string }
    ): Promise<string>;
    confirmTransaction(
      signature: string,
      commitment?: string
    ): Promise<{ value: { err: unknown } }>;
  }

  export class PublicKey {
    constructor(value: string | Uint8Array);
    static findProgramAddressSync(
      seeds: Array<Uint8Array | Buffer>,
      programId: PublicKey
    ): [PublicKey, number];
    toBase58(): string;
    toBuffer(): Buffer;
    toBytes(): Uint8Array;
    toString(): string;
    equals(other: PublicKey): boolean;
  }

  export class Keypair {
    static fromSecretKey(secretKey: Uint8Array): Keypair;
    static generate(): Keypair;
    publicKey: PublicKey;
    secretKey: Uint8Array;
  }

  export class Transaction {
    constructor();
    add(...instructions: TransactionInstruction[]): Transaction;
    sign(...signers: Keypair[]): void;
    serialize(): Buffer;
    recentBlockhash: string;
    feePayer: PublicKey;
  }

  export class TransactionInstruction {
    constructor(opts: {
      keys: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>;
      programId: PublicKey;
      data?: Buffer;
    });
  }
}
