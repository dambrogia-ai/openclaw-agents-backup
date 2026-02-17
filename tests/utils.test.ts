import { getCurrentTimestamp, pathExists, ensureDirectoryExists } from '../src/utils';
import * as fs from 'fs';

describe('Utils', () => {
  describe('getCurrentTimestamp', () => {
    it('should return ISO formatted timestamp', () => {
      const timestamp = getCurrentTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return a valid date', () => {
      const timestamp = getCurrentTimestamp();
      const date = new Date(timestamp);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('pathExists', () => {
    it('should return true for existing path', () => {
      expect(pathExists(__filename)).toBe(true);
    });

    it('should return false for non-existing path', () => {
      expect(pathExists('/nonexistent/path/to/file')).toBe(false);
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', () => {
      const testDir = `/tmp/test-dir-${Date.now()}`;
      ensureDirectoryExists(testDir);
      expect(fs.existsSync(testDir)).toBe(true);
      fs.rmSync(testDir, { recursive: true });
    });

    it('should not fail if directory already exists', () => {
      const testDir = `/tmp/test-dir-existing-${Date.now()}`;
      fs.mkdirSync(testDir);
      expect(() => ensureDirectoryExists(testDir)).not.toThrow();
      fs.rmSync(testDir, { recursive: true });
    });

    it('should create nested directories', () => {
      const testDir = `/tmp/test/nested/dir-${Date.now()}`;
      ensureDirectoryExists(testDir);
      expect(fs.existsSync(testDir)).toBe(true);
      fs.rmSync('/tmp/test', { recursive: true });
    });
  });
});
