# Skill: OpenClaw Agents Backup

Backup and restore OpenClaw multi-agent workspaces. Centralized backup of all agent configuration files, workspaces, and agent directories with disaster recovery capabilities.

## Overview

This skill enables automated hourly backups of OpenClaw agents in multi-agent setups. It discovers all active agents via the OpenClaw API, backs up their workspace and agent directories to a centralized Git repository, and provides restore functionality for disaster recovery.

### Use Cases

- **Multi-agent deployments** — Back up multiple agents in a single OpenClaw instance
- **Disaster recovery** — Wipe a VPS and restore agent state to any point in history
- **Configuration snapshots** — Track changes to agent identity, workspace files, and session history
- **Compliance** — Maintain audit trail of agent configuration changes

## Installation

This skill is designed as a TypeScript library. Install it in your project:

```bash
npm install @dambrogia/openclaw-agents-backup
```

Or clone from GitHub and use as a local dependency.

## Usage Patterns

### For End Users: Agent-Driven Backups

Install the package once. Agent calls CLI commands. User tells agent what they need.

**Setup:**
```bash
npm install @dambrogia/openclaw-agents-backup
```

**Agent calls:**
```bash
backup-agents backup              # Back up now
backup-agents restore             # Restore latest
backup-agents restore --sha ABC123 # Point-in-time
backup-agents history             # Show log
```

**User interaction:**
- "Back up my agents" → Agent runs `backup-agents backup`
- "Restore my agents" → Agent runs `backup-agents restore`
- "Show backup history" → Agent runs `backup-agents history`

### For Developers: Direct Library Use

Install as a dependency and call functions directly in your code.

## Setup

### 1. Create Backup Repository

Initialize a private Git repository where backups will be stored:

```bash
mkdir agents-backup
cd agents-backup
git init
git config user.email "backup@example.com"
git config user.name "Backup Agent"
git commit --allow-empty -m "Initial commit"
```

### 2. Create Backup Configuration

In your OpenClaw workspace, create `.backupconfig.json`:

```json
{
  "backupRepoPath": "/path/to/agents-backup"
}
```

The `backupRepoPath` should point to the local backup Git repository (already initialized and with a remote configured).

### 3. Schedule Hourly Backups (via Cron)

Use OpenClaw's cron functionality to schedule hourly backups:

```typescript
const { performBackup } = require('@dambrogia/openclaw-agents-backup');

// Hourly backup job
cron.add({
  name: 'agents-backup-hourly',
  schedule: { kind: 'cron', expr: '0 * * * *' },
  payload: {
    kind: 'agentTurn',
    message: 'Run backup',
    timeoutSeconds: 300
  },
  sessionTarget: 'isolated'
});
```

Or use OpenClaw's built-in scheduling to call the backup function.

## CLI

### Commands

```bash
backup-agents backup              # Back up all agents now
backup-agents restore             # Restore to latest
backup-agents restore --sha SHA   # Restore to specific commit
backup-agents history             # Show recent backups
```

## API (Library Reference)

For developers using the library directly (not required for typical CLI usage).

### Backup

```typescript
import { performBackup } from '@dambrogia/openclaw-agents-backup';

const result = await performBackup('/root/.openclaw/workspace');

// Result
{
  success: boolean;
  message: string;
  agentsProcessed: number;
  changes: Array<{
    agentId: string;
    workspaceChanged: boolean;
    agentDirChanged: boolean;
    error?: string;
  }>;
  error?: string;
}
```

**What it does:**
1. Queries OpenClaw for all agent bindings
2. For each agent, creates/updates `archives/<agent-id>/`
3. Syncs workspace and agent directories using `rsync --archive --delete`
4. Stores agent metadata in `archives/<agent-id>/agent.json`
5. Commits changes to Git with a timestamp

### Restore

```typescript
import { performRestore } from '@dambrogia/openclaw-agents-backup';

// Restore latest backup
const result = await performRestore(
  '/path/to/backup-repo',
  null, // or pass a git SHA for point-in-time restore
  '/root/.openclaw/workspace'
);

// Result
{
  success: boolean;
  message: string;
  agentsRestored: number;
  error?: string;
}
```

**What it does:**
1. Reads all agent archives from `archives/`
2. For each agent, restores workspace and agent directory to original locations
3. Uses rsync to sync directories with `--archive --delete`

## Backup Structure

```
agents-backup/
├── .git/                          # Git history
├── archives/
│   ├── main/
│   │   ├── agent.json             # Agent metadata (id, paths, timestamp)
│   │   ├── workspace/             # Synced from <agent.workspace>
│   │   │   ├── SOUL.md
│   │   │   ├── USER.md
│   │   │   ├── MEMORY.md
│   │   │   ├── memory/
│   │   │   └── ...
│   │   └── agentDir/              # Synced from <agent.agentDir>
│   │       ├── sessions/
│   │       └── ...
│   ├── secondary/
│   │   ├── agent.json
│   │   ├── workspace/
│   │   └── agentDir/
│   └── ...
└── .gitignore                     # Ignores .env*, auth-profiles.json, etc.
```

## Ignored Files

The following patterns are automatically ignored by Git:

```
# Credentials and secrets
.env
.env.local
.env.*.local
auth-profiles.json
auth-profiles.*

# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build artifacts
dist/
*.js
*.js.map
*.d.ts

# IDE
.vscode/
.idea/
.DS_Store

# Logs
*.log
logs/
```

**Why?** Sensitive credentials (GitHub PAT, API keys) should never be committed. Store these in `.env` or `.env.local` files, which are backed up but not committed to Git.

## Disaster Recovery Workflow

### Scenario: Restore agents after VPS wipe

**Step 1: Set up new VPS**
```bash
# Install OpenClaw, configure initial workspace
openclaw init
```

**Step 2: Clone backup repository**
```bash
git clone <backup-repo-url> /path/to/agents-backup
```

**Step 3: Create backup config**
```bash
# In /root/.openclaw/workspace/.backupconfig.json
echo '{"backupRepoPath": "/path/to/agents-backup"}' > /root/.openclaw/workspace/.backupconfig.json
```

**Step 4: Restore from backup**
```bash
# Run the restore function
node -e "require('@dambrogia/openclaw-agents-backup').performRestore('/path/to/agents-backup', null, '/root/.openclaw/workspace').then(console.log)"
```

**Step 5: Verify agents**
```bash
openclaw agents list --bindings --json
```

### Restore to a specific point in time

Find the commit you want to restore from:

```bash
cd /path/to/agents-backup
git log --oneline
# Pick a commit SHA
git checkout <commit-sha>
```

Then run restore as normal.

## Implementation Details

### Agent Discovery

Agents are discovered via `openclaw agents list --bindings --json`, which returns:

```json
[
  {
    "id": "main",
    "identityName": "dambrogia-ai-dev",
    "identityEmoji": "⚙️",
    "workspace": "/root/.openclaw/workspace",
    "agentDir": "/root/.openclaw/agents/main/agent",
    "model": "anthropic/claude-haiku-4-5",
    "bindings": 0,
    "isDefault": true,
    "routes": ["default (no explicit rules)"]
  }
]
```

### Rsync Behavior

- **`--archive`** — Preserves permissions, ownership, timestamps, symlinks
- **`--delete`** — Removes files in destination that no longer exist in source
- **Dry-run check** — Detects changes before syncing to avoid unnecessary Git commits

### Git Commit Strategy

One commit per backup run with message format:
```
Backup: 2026-02-17T05:30:45.123Z
```

This allows easy time-based filtering and point-in-time recovery.

## Testing

Run the test suite:

```bash
npm test
npm run test:coverage
```

Target: >80% code coverage

## Limitations

- **Point-in-time restore via Git SHA** — Currently documented but not fully automated. You can manually `git checkout <sha>` the backup repo before restoring.
- **Incremental backups** — All files are synced hourly, but Git only commits changed files
- **Size** — Disk usage doubles since archives contain full copies of workspace + agentDir

## Troubleshooting

### "Backup repo not initialized"
Ensure the backup repository exists and has been initialized with `git init`.

### "No changes detected"
Rsync ran but found no differences. This is normal — the next hourly run will check again.

### "Git commit failed"
The backup process completed but couldn't commit. Check:
- Git is configured in the backup repo (`git config user.email` / `user.name`)
- Remote is set up if you plan to push
- Disk space is available

### Restore shows "Archives directory not found"
Run backup at least once to create the `archives/` directory structure.

## Contributing

Issues and PRs welcome. Please include test cases for any new functionality.

## License

MIT
