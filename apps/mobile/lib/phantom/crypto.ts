import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Buffer } from 'buffer';

export const encryptForPhantom = (
  data: unknown,
  sharedSecret: Uint8Array,
): { encrypted: Uint8Array; nonce: Uint8Array } => {
  const nonce = nacl.randomBytes(24);
  const encrypted = nacl.box.after(
    new TextEncoder().encode(JSON.stringify(data)),
    nonce,
    sharedSecret,
  );
  return { encrypted, nonce };
};

export const decryptFromPhantom = <T>(
  encryptedBs58: string,
  nonceBs58: string,
  sharedSecret: Uint8Array,
): T => {
  const decrypted = nacl.box.open.after(
    bs58.decode(encryptedBs58),
    bs58.decode(nonceBs58),
    sharedSecret,
  );
  if (!decrypted) {
    throw new Error('Failed to decrypt Phantom response');
  }
  return JSON.parse(Buffer.from(decrypted).toString('utf8')) as T;
};

export const deriveSharedSecret = (
  phantomPublicKeyBs58: string,
  dappSecretKey: Uint8Array,
): Uint8Array =>
  nacl.box.before(bs58.decode(phantomPublicKeyBs58), dappSecretKey);
