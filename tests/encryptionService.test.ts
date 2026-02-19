import * as fs from 'fs';
import * as path from 'path';
import { encryptFile, decryptFile, encryptBuffer, decryptBuffer } from '../src/encryptionService';

describe('Encryption Service', () => {
  const testDir = path.join(__dirname, '.test-encryption');
  const password = 'super-secret-password-123';
  const wrongPassword = 'wrong-password';

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      files.forEach((file) => {
        const filePath = path.join(testDir, file);
        if (fs.lstatSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
  });

  describe('encryptFile & decryptFile', () => {
    it('should encrypt and decrypt a file correctly', () => {
      const inputPath = path.join(testDir, 'plaintext.jsonl');
      const encryptedPath = path.join(testDir, 'plaintext.jsonl.enc');
      const decryptedPath = path.join(testDir, 'plaintext.jsonl.dec');

      const plaintext = '{"id": "agent-1", "messages": [{"role": "user", "content": "Hello"}]}';
      fs.writeFileSync(inputPath, plaintext);

      // Encrypt
      encryptFile(inputPath, encryptedPath, password);
      expect(fs.existsSync(encryptedPath)).toBe(true);

      // Verify encrypted file is different
      const encryptedContent = fs.readFileSync(encryptedPath);
      expect(encryptedContent.toString()).not.toBe(plaintext);

      // Decrypt
      decryptFile(encryptedPath, decryptedPath, password);
      expect(fs.existsSync(decryptedPath)).toBe(true);

      // Verify decrypted matches original
      const decrypted = fs.readFileSync(decryptedPath, 'utf8');
      expect(decrypted).toBe(plaintext);
    });

    it('should fail to decrypt with wrong password', () => {
      const inputPath = path.join(testDir, 'plaintext2.jsonl');
      const encryptedPath = path.join(testDir, 'plaintext2.jsonl.enc');
      const decryptedPath = path.join(testDir, 'plaintext2.jsonl.dec');

      const plaintext = '{"data": "secret"}';
      fs.writeFileSync(inputPath, plaintext);

      encryptFile(inputPath, encryptedPath, password);

      // Try to decrypt with wrong password
      expect(() => {
        decryptFile(encryptedPath, decryptedPath, wrongPassword);
      }).toThrow(/Decryption failed/);
    });

    it('should handle large files', () => {
      const inputPath = path.join(testDir, 'large.jsonl');
      const encryptedPath = path.join(testDir, 'large.jsonl.enc');
      const decryptedPath = path.join(testDir, 'large.jsonl.dec');

      // Create a 10MB file with repeated JSON lines
      const line = '{"id": "x", "data": "' + 'a'.repeat(100) + '"}\n';
      let content = '';
      for (let i = 0; i < 10000; i++) {
        content += line;
      }
      fs.writeFileSync(inputPath, content);

      encryptFile(inputPath, encryptedPath, password);
      decryptFile(encryptedPath, decryptedPath, password);

      const decrypted = fs.readFileSync(decryptedPath, 'utf8');
      expect(decrypted).toBe(content);
    });

    it('should produce different ciphertext for same plaintext with different passwords', () => {
      const inputPath = path.join(testDir, 'plaintext3.jsonl');
      const encrypted1Path = path.join(testDir, 'plaintext3.v1.jsonl.enc');
      const encrypted2Path = path.join(testDir, 'plaintext3.v2.jsonl.enc');

      const plaintext = '{"test": "data"}';
      fs.writeFileSync(inputPath, plaintext);

      encryptFile(inputPath, encrypted1Path, password);
      encryptFile(inputPath, encrypted2Path, password);

      // Both should decrypt to original
      const decrypted1Path = path.join(testDir, 'dec1.jsonl');
      const decrypted2Path = path.join(testDir, 'dec2.jsonl');

      decryptFile(encrypted1Path, decrypted1Path, password);
      decryptFile(encrypted2Path, decrypted2Path, password);

      expect(fs.readFileSync(decrypted1Path, 'utf8')).toBe(plaintext);
      expect(fs.readFileSync(decrypted2Path, 'utf8')).toBe(plaintext);

      // But ciphertexts should be different (due to random IV and salt)
      const cipher1 = fs.readFileSync(encrypted1Path);
      const cipher2 = fs.readFileSync(encrypted2Path);
      expect(cipher1).not.toEqual(cipher2);
    });

    it('should fail gracefully on corrupted encrypted file', () => {
      const inputPath = path.join(testDir, 'plaintext4.jsonl');
      const encryptedPath = path.join(testDir, 'plaintext4.jsonl.enc');
      const decryptedPath = path.join(testDir, 'plaintext4.jsonl.dec');

      fs.writeFileSync(inputPath, 'test data');
      encryptFile(inputPath, encryptedPath, password);

      // Corrupt the file
      const corrupted = fs.readFileSync(encryptedPath);
      corrupted[10] = corrupted[10] ^ 0xff; // Flip bits
      fs.writeFileSync(encryptedPath, corrupted);

      // Should fail to decrypt
      expect(() => {
        decryptFile(encryptedPath, decryptedPath, password);
      }).toThrow(/Decryption failed/);
    });

    it('should reject too-short encrypted file', () => {
      const encryptedPath = path.join(testDir, 'too-short.enc');
      const decryptedPath = path.join(testDir, 'too-short.dec');

      // Write a file that's too short to contain header
      fs.writeFileSync(encryptedPath, Buffer.alloc(10));

      expect(() => {
        decryptFile(encryptedPath, decryptedPath, password);
      }).toThrow(/Invalid encrypted file/);
    });
  });

  describe('encryptBuffer & decryptBuffer', () => {
    it('should encrypt and decrypt buffer correctly', () => {
      const plaintext = Buffer.from('{"id": 1, "content": "test"}');

      const encrypted = encryptBuffer(plaintext, password);
      expect(encrypted).not.toEqual(plaintext);

      const decrypted = decryptBuffer(encrypted, password);
      expect(decrypted).toEqual(plaintext);
    });

    it('should fail to decrypt buffer with wrong password', () => {
      const plaintext = Buffer.from('secret data');
      const encrypted = encryptBuffer(plaintext, password);

      expect(() => {
        decryptBuffer(encrypted, wrongPassword);
      }).toThrow(/Decryption failed/);
    });

    it('should handle empty buffer', () => {
      const plaintext = Buffer.alloc(0);

      const encrypted = encryptBuffer(plaintext, password);
      const decrypted = decryptBuffer(encrypted, password);

      expect(decrypted.length).toBe(0);
    });

    it('should produce deterministic decryption', () => {
      const plaintext = Buffer.from('test data');

      const encrypted = encryptBuffer(plaintext, password);
      const dec1 = decryptBuffer(encrypted, password);
      const dec2 = decryptBuffer(encrypted, password);

      expect(dec1).toEqual(dec2);
      expect(dec1).toEqual(plaintext);
    });

    it('should fail gracefully on too-short buffer', () => {
      const tooShort = Buffer.alloc(10);

      expect(() => {
        decryptBuffer(tooShort, password);
      }).toThrow(/Invalid encrypted buffer/);
    });
  });

  describe('Password handling', () => {
    it('should handle special characters in password', () => {
      const specialPassword = 'p@$$w0rd!#%&*(){}[]|\\:;"<>?,./';
      const inputPath = path.join(testDir, 'special.jsonl');
      const encryptedPath = path.join(testDir, 'special.jsonl.enc');
      const decryptedPath = path.join(testDir, 'special.jsonl.dec');

      fs.writeFileSync(inputPath, 'test');
      encryptFile(inputPath, encryptedPath, specialPassword);
      decryptFile(encryptedPath, decryptedPath, specialPassword);

      expect(fs.readFileSync(decryptedPath, 'utf8')).toBe('test');
    });

    it('should handle unicode password', () => {
      const unicodePassword = '密码🔒パスワード';
      const inputPath = path.join(testDir, 'unicode.jsonl');
      const encryptedPath = path.join(testDir, 'unicode.jsonl.enc');
      const decryptedPath = path.join(testDir, 'unicode.jsonl.dec');

      fs.writeFileSync(inputPath, 'sensitive data');
      encryptFile(inputPath, encryptedPath, unicodePassword);
      decryptFile(encryptedPath, decryptedPath, unicodePassword);

      expect(fs.readFileSync(decryptedPath, 'utf8')).toBe('sensitive data');
    });

    it('should differentiate between similar passwords', () => {
      const pass1 = 'password';
      const pass2 = 'password '; // space at end
      const inputPath = path.join(testDir, 'pass-diff.jsonl');
      const encryptedPath = path.join(testDir, 'pass-diff.jsonl.enc');
      const decryptedPath = path.join(testDir, 'pass-diff.jsonl.dec');

      fs.writeFileSync(inputPath, 'data');
      encryptFile(inputPath, encryptedPath, pass1);

      // Should fail with pass2
      expect(() => {
        decryptFile(encryptedPath, decryptedPath, pass2);
      }).toThrow(/Decryption failed/);
    });
  });

  describe('Encryption properties', () => {
    it('should produce different ciphertext each time (random IV and salt)', () => {
      const plaintext = Buffer.from('same data');

      const encrypted1 = encryptBuffer(plaintext, password);
      const encrypted2 = encryptBuffer(plaintext, password);

      // Should be different due to random salt and IV
      expect(encrypted1).not.toEqual(encrypted2);

      // But both should decrypt to original
      expect(decryptBuffer(encrypted1, password)).toEqual(plaintext);
      expect(decryptBuffer(encrypted2, password)).toEqual(plaintext);
    });

    it('should maintain data integrity with authentication tag', () => {
      const plaintext = Buffer.from('verified data');
      const encrypted = encryptBuffer(plaintext, password);

      // Flip bits in middle of ciphertext (after header)
      const headerSize = 16 + 16 + 16; // salt + iv + authTag
      encrypted[headerSize + 5] ^= 0xff;

      // Decryption should fail due to auth tag mismatch
      expect(() => {
        decryptBuffer(encrypted, password);
      }).toThrow(/Decryption failed/);
    });
  });
});
