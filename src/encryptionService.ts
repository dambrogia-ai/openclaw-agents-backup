import * as crypto from 'crypto';
import * as fs from 'fs';

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha256';

export interface EncryptionHeader {
  salt: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Encrypt a file with AES-256-GCM using PBKDF2 key derivation
 * @param inputPath Path to input file
 * @param outputPath Path to output file (.jsonl.enc)
 * @param password Encryption password
 */
export function encryptFile(inputPath: string, outputPath: string, password: string): void {
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from password using PBKDF2
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, PBKDF2_DIGEST);

  // Read plaintext
  const plaintext = fs.readFileSync(inputPath);

  // Encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Write: [salt][iv][authTag][ciphertext]
  const output = Buffer.concat([salt, iv, authTag, encrypted]);
  fs.writeFileSync(outputPath, output);
}

/**
 * Decrypt a file encrypted with encryptFile()
 * @param inputPath Path to input file (.jsonl.enc)
 * @param outputPath Path to output file
 * @param password Encryption password
 */
export function decryptFile(inputPath: string, outputPath: string, password: string): void {
  // Read encrypted file
  const encrypted = fs.readFileSync(inputPath);

  // Parse header: [salt][iv][authTag][ciphertext]
  if (encrypted.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted file: too short');
  }

  let offset = 0;
  const salt = encrypted.subarray(offset, (offset += SALT_LENGTH));
  const iv = encrypted.subarray(offset, (offset += IV_LENGTH));
  const authTag = encrypted.subarray(offset, (offset += AUTH_TAG_LENGTH));
  const ciphertext = encrypted.subarray(offset);

  // Derive key from password using same parameters
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, PBKDF2_DIGEST);

  // Decrypt
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    fs.writeFileSync(outputPath, plaintext);
  } catch (error) {
    throw new Error(`Decryption failed: invalid password or corrupted file - ${error}`);
  }
}

/**
 * Encrypt a buffer with AES-256-GCM
 * @param data Buffer to encrypt
 * @param password Encryption password
 * @returns Encrypted buffer with header
 */
export function encryptBuffer(data: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, PBKDF2_DIGEST);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Decrypt a buffer encrypted with encryptBuffer()
 * @param encrypted Encrypted buffer with header
 * @param password Encryption password
 * @returns Decrypted buffer
 */
export function decryptBuffer(encrypted: Buffer, password: string): Buffer {
  if (encrypted.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted buffer: too short');
  }

  let offset = 0;
  const salt = encrypted.subarray(offset, (offset += SALT_LENGTH));
  const iv = encrypted.subarray(offset, (offset += IV_LENGTH));
  const authTag = encrypted.subarray(offset, (offset += AUTH_TAG_LENGTH));
  const ciphertext = encrypted.subarray(offset);

  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, PBKDF2_DIGEST);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error) {
    throw new Error(`Decryption failed: invalid password or corrupted data - ${error}`);
  }
}
