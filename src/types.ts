/**
 * OpenClaw agent binding information returned by `openclaw agents list --bindings --json`
 */
export interface AgentBinding {
  id: string;
  identityName: string;
  identityEmoji: string;
  identitySource: string;
  workspace: string;
  agentDir: string;
  model: string;
  bindings: number;
  isDefault: boolean;
  routes: string[];
}

/**
 * Backup configuration loaded from .backupconfig.json
 */
export interface BackupConfig {
  backupRepoPath: string;
}

/**
 * Agent archive metadata stored in archives/<agent-id>/agent.json
 */
export interface AgentArchiveMetadata {
  id: string;
  identityName: string;
  identityEmoji: string;
  identitySource: string;
  workspace: string;
  agentDir: string;
  model: string;
  bindings: number;
  isDefault: boolean;
  routes: string[];
  backedUpAt: string;
}

/**
 * Result of a backup operation
 */
export interface BackupResult {
  success: boolean;
  message: string;
  agentsProcessed: number;
  changes: BackupChange[];
  error?: string;
}

/**
 * Individual agent backup status
 */
export interface BackupChange {
  agentId: string;
  workspaceChanged: boolean;
  agentDirChanged: boolean;
  error?: string;
}

/**
 * Result of a restore operation
 */
export interface RestoreResult {
  success: boolean;
  message: string;
  agentsRestored: number;
  error?: string;
  authOverwriteWarning?: boolean;
}
