import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Execute a shell command and return output as string
 */
export function executeCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    throw new Error(`Command failed: ${command}\nError: ${error}`);
  }
}

/**
 * Check if a path exists
 */
export function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Read JSON file
 */
export function readJsonFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as T;
}

/**
 * Write JSON file with formatting
 */
export function writeJsonFile<T>(filePath: string, data: T): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Sync directory with rsync
 * @param source Source directory (must end with /)
 * @param destination Destination directory
 * @returns true if changes were made
 */
export function rsyncDirectory(source: string, destination: string): boolean {
  // Ensure source ends with / for rsync semantics (sync contents, not dir itself)
  const normalizedSource = source.endsWith('/') ? source : `${source}/`;

  try {
    // rsync with --archive --delete
    // --dry-run first to check if there are changes
    const dryRunOutput = executeCommand(
      `rsync --archive --delete --dry-run "${normalizedSource}" "${destination}" 2>&1 || true`
    );

    // If no changes, exit early
    if (!dryRunOutput || dryRunOutput.trim() === '') {
      return false;
    }

    // Perform actual sync
    executeCommand(`rsync --archive --delete "${normalizedSource}" "${destination}"`);
    return true;
  } catch (error) {
    throw new Error(`Rsync failed for ${source} -> ${destination}: ${error}`);
  }
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Ensure directory exists
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
