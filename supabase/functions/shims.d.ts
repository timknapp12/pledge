// TypeScript shim declarations for Supabase Edge Functions (Deno runtime).
// These files are executed by Deno, but our workspace TypeScript tooling
// doesn't understand URL imports or the global `Deno` namespace by default.

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

declare module 'std/http/server.ts' {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: unknown
  ): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  // Keep it loose: runtime is Deno; types aren't required for our build pipeline here.
  export function createClient(url: string, key: string, options?: unknown): any;
}

declare module 'https://esm.sh/@solana/web3.js@1' {
  export const Connection: any;
  export const Keypair: any;
  export const PublicKey: any;
}

declare module 'https://esm.sh/@coral-xyz/anchor@0.28.0' {
  export const Program: any;
  export const AnchorProvider: any;
}

declare module 'https://esm.sh/@noble/ed25519@2' {
  export const verifyAsync: any;
}

declare module 'https://esm.sh/bs58@5' {
  export const decode: any;
}

declare module 'https://deno.land/x/jose@v4.14.4/index.ts' {
  export const SignJWT: any;
}

