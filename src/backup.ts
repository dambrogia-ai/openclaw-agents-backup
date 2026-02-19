import * as path from 'path';
import * as fs from 'fs';
import { BackupConfig, BackupResult, BackupChange, AgentArchiveMetadata } from './types';
import {
  pathExists,
  rsyncDirectory,
  writeJsonFile,
  ensureDirectoryExists,
  executeCommand,
  getCurrentTimestamp,
  findAllFiles
} from './utils';
import { listAgents, validateAgentBinding } from './agentLister';
import { encryptFile } from './encryptionService';

/**
 * Perform backup of all agents to the configured backup repository
 */
export async function performBackup(workspacePath: string): Promise<BackupResult> {
  try {
    // Load backup configuration
    const configPath = path.join(workspacePath, '.backupconfig.json');
    if (!pathExists(configPath)) {
      return {
        success: false,
        message: 'Backup config not found at .backupconfig.json',
        agentsProcessed: 0,
        changes: [],
        error: 'Missing .backupconfig.json'
      };
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as BackupConfig;
    const backupRepoPath = config.backupRepoPath;

    if (!pathExists(backupRepoPath)) {
      return {
        success: false,
        message: `Backup repository not found at ${backupRepoPath}`,
        agentsProcessed: 0,
        changes: [],
        error: 'Backup repo not initialized'
      };
    }

    // Get encryption password from environment
    const encryptionPassword = process.env.BACKUP_ENCRYPTION_PASSWORD;
    if (!encryptionPassword) {
      return {
        success: false,
        message: 'Backup encryption password not set',
        agentsProcessed: 0,
        changes: [],
        error: 'Missing BACKUP_ENCRYPTION_PASSWORD environment variable'
      };
    }

    // Get list of agents
    const agents = await listAgents();

    // Validate agents
    const validAgents = agents.filter((agent) => {
      const valid = validateAgentBinding(agent);
      if (!valid) {
        console.warn(`Agent ${agent.id} failed validation, skipping`);
      }
      return valid;
    });

    const changes: BackupChange[] = [];
    const archivesPath = path.join(backupRepoPath, 'archives');
    ensureDirectoryExists(archivesPath);

    // Back up each agent
    for (const agent of validAgents) {
      const agentArchivePath = path.join(archivesPath, agent.id);
      ensureDirectoryExists(agentArchivePath);

      const backupChange: BackupChange = {
        agentId: agent.id,
        workspaceChanged: false,
        agentDirChanged: false
      };

      try {
        // Write agent metadata
        const metadata: AgentArchiveMetadata = {
          id: agent.id,
          identityName: agent.identityName,
          identityEmoji: agent.identityEmoji,
          identitySource: agent.identitySource,
          workspace: agent.workspace,
          agentDir: agent.agentDir,
          model: agent.model,
          bindings: agent.bindings,
          isDefault: agent.isDefault,
          routes: agent.routes,
          backedUpAt: getCurrentTimestamp()
        };
        writeJsonFile(path.join(agentArchivePath, 'agent.json'), metadata);

        // Sync workspace
        const workspaceDestination = path.join(agentArchivePath, 'workspace');
        ensureDirectoryExists(workspaceDestination);
        backupChange.workspaceChanged = rsyncDirectory(agent.workspace, workspaceDestination);

        // Sync agent directory (includes both agent/ and sessions/ directories)
        // Source: ${agentDir}/.. to capture agent/ and sessions/ together
        const agentDirParent = path.join(agent.agentDir, '..');
        const agentDirDestination = path.join(agentArchivePath, 'agentDir');
        ensureDirectoryExists(agentDirDestination);
        backupChange.agentDirChanged = rsyncDirectory(agentDirParent, agentDirDestination);

        // Encrypt all files in agentDir backup
        const allFiles = findAllFiles(agentDirDestination);
        for (const file of allFiles) {
          // Skip already encrypted files
          if (file.endsWith('.enc')) {
            continue;
          }

          try {
            const encryptedPath = `${file}.enc`;
            encryptFile(file, encryptedPath, encryptionPassword);
            // Delete plaintext after successful encryption
            fs.unlinkSync(file);
          } catch (error) {
            backupChange.error = `Failed to encrypt ${file}: ${error}`;
            throw error;
          }
        }

        changes.push(backupChange);
      } catch (error) {
        backupChange.error = String(error);
        changes.push(backupChange);
      }
    }

    // Always commit since metadata (backedUpAt) is always updated
    try {
      await gitCommitBackup(backupRepoPath);
    } catch (error) {
      return {
        success: false,
        message: 'Backup completed but git commit failed',
        agentsProcessed: validAgents.length,
        changes,
        error: String(error)
      };
    }

    return {
      success: true,
      message: `Backed up ${validAgents.length} agents. Changes: ${changes.filter((c) => c.workspaceChanged || c.agentDirChanged).length}`,
      agentsProcessed: validAgents.length,
      changes
    };
  } catch (error) {
    return {
      success: false,
      message: 'Backup failed',
      agentsProcessed: 0,
      changes: [],
      error: String(error)
    };
  }
}

/**
 * Commit backup changes to git repository
 */
async function gitCommitBackup(repoPath: string): Promise<void> {
  const currentDir = process.cwd();
  try {
    process.chdir(repoPath);

    // Stage all changes
    executeCommand('git add -A');

    // Create commit message
    const timestamp = getCurrentTimestamp();
    const commitMessage = `Backup: ${timestamp}`;

    // Commit changes
    executeCommand(`git commit -m "${commitMessage}"`);
  } finally {
    process.chdir(currentDir);
  }
}
