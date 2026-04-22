// Persistent Phantom session state.
// The dApp keypair lives for the lifetime of the install — regenerating it
// while sharedSecret is cached corrupts every subsequent signature.
export interface PhantomSessionState {
  dappSecretKeyBs58: string;
  dappPublicKeyBs58: string;
  phantomPublicKeyBs58: string | null;
  sharedSecretBs58: string | null;
  sessionToken: string | null;
  walletPublicKey: string | null;
}

export type PhantomCluster = 'mainnet-beta' | 'devnet';
