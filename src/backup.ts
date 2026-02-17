import * as path from 'path';
import * as fs from 'fs';
import { AgentBinding, BackupConfig, BackupResult, BackupChange, AgentArchiveMetadata } from './types';
import {
  pathExists,
  rsyncDirectory,
  writeJsonFile,
  ensureDirectoryExists,
  executeCommand,
  getCurrentTimestamp
} from './utils';
import { listAgents, validateAgentBinding } from './agentLister';

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

        // Sync agent directory
        const agentDirDestination = path.join(agentArchivePath, 'agentDir');
        ensureDirectoryExists(agentDirDestination);
        backupChange.agentDirChanged = rsyncDirectory(agent.agentDir, agentDirDestination);

        changes.push(backupChange);
      } catch (error) {
        backupChange.error = String(error);
        changes.push(backupChange);
      }
    }

    // Check if any changes were made
    const hasChanges = changes.some((c) => c.workspaceChanged || c.agentDirChanged);

    // Commit to git if there are changes
    if (hasChanges) {
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
