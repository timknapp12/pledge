// TypeScript shim declarations for Supabase Edge Functions (Deno runtime).
// These files are executed by Deno, but our workspace TypeScript tooling
// doesn't understand the Deno global namespace by default.

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

// Module declarations for npm: imports used via deno.json import maps
declare module "@supabase/supabase-js" {
  export function createClient(url: string, key: string, options?: unknown): any;
}

declare module "@noble/ed25519" {
  export function verify(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array
  ): boolean;
  export const etc: {
    sha512Sync: ((...m: Uint8Array[]) => Uint8Array) | undefined;
    concatBytes: (...arrays: Uint8Array[]) => Uint8Array;
  };
}

declare module "@noble/hashes/sha512" {
  export function sha512(data: Uint8Array): Uint8Array;
}

declare module "bs58" {
  const bs58: {
    encode(data: Uint8Array): string;
    decode(data: string): Uint8Array;
  };
  export default bs58;
}

declare module "jose" {
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
declare module "jsr:@supabase/functions-js/edge-runtime.d.ts" {}
