import * as path from 'path';
import * as fs from 'fs';
import { RestoreResult, AgentArchiveMetadata } from './types';
import { pathExists, rsyncDirectory, readJsonFile, ensureDirectoryExists, findEncryptedFiles } from './utils';
import { decryptFile } from './encryptionService';

/**
 * Restore agents from backup to specified git SHA or latest
 * @param backupRepoPath Path to backup repository
 * @param targetSha Git SHA to restore from (if null, uses current state)
 * @param workspacePath Base path where agents will be restored
 * @param confirmAuthOverwrite If true, allows overwriting auth-profiles.json without warning
 */
export async function performRestore(
  backupRepoPath: string,
  targetSha: string | null,
  _workspacePath: string,
  confirmAuthOverwrite: boolean = false
): Promise<RestoreResult> {
  try {
    if (!pathExists(backupRepoPath)) {
      return {
        success: false,
        message: `Backup repository not found at ${backupRepoPath}`,
        agentsRestored: 0,
        error: 'Backup repo not found'
      };
    }

    const archivesPath = path.join(backupRepoPath, 'archives');
    if (!pathExists(archivesPath)) {
      return {
        success: false,
        message: 'Archives directory not found in backup repository',
        agentsRestored: 0,
        error: 'No archives found'
      };
    }

    // Get encryption password from environment
    const encryptionPassword = process.env.BACKUP_ENCRYPTION_PASSWORD;
    if (!encryptionPassword) {
      return {
        success: false,
        message: 'Backup encryption password not set',
        agentsRestored: 0,
        error: 'Missing BACKUP_ENCRYPTION_PASSWORD environment variable'
      };
    }

    // If target SHA specified, we would ideally check out that commit
    // For now, we work with current state (could be enhanced)
    if (targetSha) {
      console.warn(`Note: targetSha specified (${targetSha}) but not implemented in this version`);
    }

    // List all agent directories
    const agentDirs = fs
      .readdirSync(archivesPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    let agentsRestored = 0;
    const errors: string[] = [];

    // Restore each agent
    for (const agentId of agentDirs) {
      const agentArchivePath = path.join(archivesPath, agentId);
      const metadataPath = path.join(agentArchivePath, 'agent.json');

      try {
        // Read metadata
        const metadata = readJsonFile<AgentArchiveMetadata>(metadataPath);

        // Restore workspace
        const workspaceSource = path.join(agentArchivePath, 'workspace');
        if (pathExists(workspaceSource)) {
          ensureDirectoryExists(metadata.workspace);
          rsyncDirectory(workspaceSource, metadata.workspace);
        }

        // Restore agent directory
        const agentDirSource = path.join(agentArchivePath, 'agentDir');
        if (pathExists(agentDirSource)) {
          // Decrypt all .enc files before restoring
          const encryptedFiles = findEncryptedFiles(agentDirSource);
          for (const encFile of encryptedFiles) {
            try {
              const plainPath = encFile.substring(0, encFile.length - 4); // Remove .enc suffix
              decryptFile(encFile, plainPath, encryptionPassword);
              // Delete encrypted file after successful decryption
              fs.unlinkSync(encFile);
            } catch (error) {
              throw new Error(`Failed to decrypt ${encFile}: ${error}`);
            }
          }

          // Check if auth-profiles.json exists in the backup
          const backupAuthPath = path.join(agentDirSource, 'agent', 'auth-profiles.json');
          if (pathExists(backupAuthPath)) {
            if (!confirmAuthOverwrite) {
              return {
                success: false,
                message: 'Backup contains sensitive auth-profiles.json (API tokens). Use --confirm-auth-overwrite to proceed.',
                agentsRestored: 0,
                authOverwriteWarning: true
              };
            }
          }

          ensureDirectoryExists(metadata.agentDir);
          rsyncDirectory(agentDirSource, metadata.agentDir);
        }

        agentsRestored++;
      } catch (error) {
        errors.push(`Agent ${agentId}: ${error}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: `Restored ${agentsRestored} agents with errors`,
        agentsRestored,
        error: errors.join('\n')
      };
    }

    return {
      success: true,
      message: `Successfully restored ${agentsRestored} agents`,
      agentsRestored
    };
  } catch (error) {
    return {
      success: false,
      message: 'Restore operation failed',
      agentsRestored: 0,
      error: String(error)
    };
  }
}
