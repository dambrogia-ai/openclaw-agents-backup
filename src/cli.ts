#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { performBackup, performRestore } from './index';

/**
 * CLI entry point for backup/restore operations
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  const workspace = process.env.OPENCLAW_WORKSPACE || '/root/.openclaw/workspace';
  const configPath = path.join(workspace, '.backupconfig.json');

  if (!fs.existsSync(configPath)) {
    console.error('❌ Error: .backupconfig.json not found at ' + configPath);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const backupRepoPath = config.backupRepoPath;

  try {
    switch (command) {
      case 'backup':
        await handleBackup(workspace);
        break;

      case 'restore':
        await handleRestore(backupRepoPath, workspace, args);
        break;

      case 'history':
        await handleHistory(backupRepoPath);
        break;

      case '--help':
      case '-h':
      case undefined:
        showHelp();
        break;

      default:
        console.error('❌ Unknown command: ' + command);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

async function handleBackup(workspace: string): Promise<void> {
  console.log('🔄 Starting backup...');
  const result = await performBackup(workspace);

  if (result.success) {
    console.log('✅ Backup complete');
    console.log(`   Agents processed: ${result.agentsProcessed}`);
    console.log(
      `   Changes: ${result.changes.filter((c) => c.workspaceChanged || c.agentDirChanged).length}`
    );
    result.changes.forEach((change) => {
      if (change.workspaceChanged || change.agentDirChanged) {
        console.log(`   - ${change.agentId}: workspace=${change.workspaceChanged}, agentDir=${change.agentDirChanged}`);
      }
    });
  } else {
    console.error(`❌ Backup failed: ${result.message}`);
    if (result.error) {
      console.error(`   ${result.error}`);
    }
    process.exit(1);
  }
}

async function handleRestore(
  backupRepoPath: string,
  workspace: string,
  args: string[]
): Promise<void> {
  let targetSha: string | null = null;
  let confirmAuthOverwrite = false;

  // Check for --sha argument
  const shaIndex = args.indexOf('--sha');
  if (shaIndex !== -1 && shaIndex + 1 < args.length) {
    targetSha = args[shaIndex + 1];
    console.log(`🔄 Restoring to commit: ${targetSha}`);
  } else {
    console.log('🔄 Restoring to latest backup...');
  }

  // Check for --confirm-auth-overwrite flag
  if (args.includes('--confirm-auth-overwrite')) {
    confirmAuthOverwrite = true;
  }

  const result = await performRestore(backupRepoPath, targetSha, workspace, confirmAuthOverwrite);

  if (result.success) {
    console.log('✅ Restore complete');
    console.log(`   Agents restored: ${result.agentsRestored}`);
  } else {
    if (result.authOverwriteWarning) {
      console.warn(`⚠️  ${result.message}`);
      console.warn(`\n   To restore including sensitive credentials, run:\n   backup-agents restore ${targetSha ? `--sha ${targetSha}` : ''} --confirm-auth-overwrite`);
    } else {
      console.error(`❌ Restore failed: ${result.message}`);
      if (result.error) {
        console.error(`   ${result.error}`);
      }
    }
    process.exit(1);
  }
}

async function handleHistory(backupRepoPath: string): Promise<void> {
  const { executeCommand } = require('./utils');

  console.log('📜 Backup history:\n');
  try {
    const log = executeCommand(`cd ${backupRepoPath} && git log --oneline -20`);
    console.log(log);
  } catch (error) {
    console.error(`❌ Failed to fetch history: ${error}`);
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(`
@dambrogia/openclaw-agents-backup CLI

Usage:
  backup-agents [command] [options]

Commands:
  backup                          Backup all agents now
  restore [options]               Restore agents
  history                         Show recent backup history
  --help, -h                      Show this help message

Restore Options:
  --sha SHA                       Restore to specific commit
  --confirm-auth-overwrite        Allow overwriting auth-profiles.json (API tokens)

Examples:
  # Backup now
  backup-agents backup

  # Restore latest
  backup-agents restore

  # Restore to specific point in time
  backup-agents restore --sha abc123def456

  # Restore including sensitive credentials
  backup-agents restore --confirm-auth-overwrite

  # View backup history
  backup-agents history

Environment:
  OPENCLAW_WORKSPACE             Path to OpenClaw workspace (default: /root/.openclaw/workspace)
  BACKUP_ENCRYPTION_PASSWORD     Password for encrypting/decrypting files (required)
`);
}

main().catch((error) => {
  console.error(`❌ Unexpected error: ${error}`);
  process.exit(1);
});
