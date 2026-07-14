import { utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { derivePasswordKeyResponsively } from '../backupPasswordKdf';

describe('responsive backup password KDF', () => {
  it('matches PBKDF2-HMAC-SHA-256 while yielding to the JavaScript event loop', async () => {
    const password = ' exact pass \u{1F512} ';
    const salt = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    const expected = pbkdf2(sha256, utf8ToBytes(password), salt, {
      c: 65,
      dkLen: 32,
    });

    try {
      const actual = await derivePasswordKeyResponsively(password, salt, 65, {
        maxSliceMs: 0,
      });

      expect(actual).toEqual(expected);
      expect(timeoutSpy).toHaveBeenCalledTimes(2);
      expect(salt).toEqual(Uint8Array.from({ length: 16 }, (_, index) => index + 1));
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});
