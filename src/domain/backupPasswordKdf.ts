import { utf8ToBytes } from '@noble/ciphers/utils.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

const PASSWORD_KEY_BYTES = 32;
const KDF_YIELD_CHECK_INTERVAL = 32;
const KDF_MAX_JS_SLICE_MS = 8;

type PasswordKdfSchedulingOptions = {
  maxSliceMs?: number;
};

export async function derivePasswordKeyResponsively(
  password: string,
  salt: Uint8Array,
  iterations: number,
  options: PasswordKdfSchedulingOptions = {},
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(iterations) || iterations < 1) {
    throw new Error('Password KDF iterations must be a positive integer.');
  }

  const maxSliceMs = options.maxSliceMs ?? KDF_MAX_JS_SLICE_MS;
  const passwordBytes = utf8ToBytes(password);
  const key = new Uint8Array(PASSWORD_KEY_BYTES);
  const blockIndex = new Uint8Array([0, 0, 0, 1]);
  const u = new Uint8Array(sha256.outputLen);
  const prf = hmac.create(sha256, passwordBytes);
  const saltedPrf = prf.clone().update(salt);
  const workingPrf = prf.clone();
  let completed = false;

  try {
    saltedPrf._cloneInto(workingPrf).update(blockIndex).digestInto(u);
    key.set(u);

    let sliceStartedAt = Date.now();
    for (let iteration = 1; iteration < iterations; iteration += 1) {
      prf._cloneInto(workingPrf).update(u).digestInto(u);
      for (let index = 0; index < key.length; index += 1) {
        key[index] ^= u[index];
      }

      if (
        iteration % KDF_YIELD_CHECK_INTERVAL === 0
        && Date.now() - sliceStartedAt >= maxSliceMs
      ) {
        // Noble's async PBKDF2 yields only to microtasks, which starves React Native render and touch work.
        await yieldToJavaScriptEventLoop();
        sliceStartedAt = Date.now();
      }
    }

    completed = true;
    return key;
  } finally {
    if (!completed) {
      key.fill(0);
    }
    passwordBytes.fill(0);
    blockIndex.fill(0);
    u.fill(0);
    prf.destroy();
    saltedPrf.destroy();
    workingPrf.destroy();
  }
}

function yieldToJavaScriptEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
