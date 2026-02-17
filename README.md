# @dambrogia/openclaw-agents-backup

Backup and restore OpenClaw multi-agent workspaces. Automated hourly snapshots with full disaster recovery capabilities.

[![npm version](https://img.shields.io/npm/v/@dambrogia/openclaw-agents-backup)](https://www.npmjs.com/package/@dambrogia/openclaw-agents-backup)
[![Tests](https://github.com/dambrogia-ai/openclaw-agents-backup/actions/workflows/test.yml/badge.svg)](https://github.com/dambrogia-ai/openclaw-agents-backup/actions)
[![Coverage](https://img.shields.io/badge/coverage->80%25-green)](./README.md)

## Why This Exists

OpenClaw enables multiple agents to run in a single instance. Each agent has its own workspace with configuration, memory, identity files, and session history. If something goes wrong—disk corruption, accidental deletion, security incident—you lose everything.

This skill automates hourly backups of all agent workspaces and agent directories to a central Git repository. When disaster strikes, you can restore any agent to any point in history by pulling from your backup repo.

## Quick Start

### 1. Initialize Backup Repository

```bash
mkdir my-agents-backup
cd my-agents-backup
git init
git config user.email "backup@example.com"
git config user.name "Backup Bot"
git commit --allow-empty -m "Initial commit"
```

### 2. Create Backup Config

In your OpenClaw workspace (`~/.openclaw/workspace`), create `.backupconfig.json`:

```json
{
  "backupRepoPath": "/path/to/my-agents-backup"
}
```

### 3. Install the Library

```bash
npm install @dambrogia/openclaw-agents-backup
```

### 4. Schedule Hourly Backups

Use OpenClaw's cron system or call the backup function hourly.

```javascript
const { performBackup } = require('@dambrogia/openclaw-agents-backup');

// Run every hour
await performBackup('/root/.openclaw/workspace');
```

### 5. Disaster Recovery

When you need to restore:

```bash
# Wipe the VPS, reinstall OpenClaw
openclaw init

# Clone your backup
git clone <backup-repo-url> /path/to/my-agents-backup

# Create config pointing to backup repo
echo '{"backupRepoPath": "/path/to/my-agents-backup"}' > ~/.openclaw/workspace/.backupconfig.json

# Restore all agents to current state
node -e "require('@dambrogia/openclaw-agents-backup').performRestore(...)"
```

## Features

✅ **Multi-agent support** — Back up all agents in one command  
✅ **Hourly snapshots** — Automated backup schedule  
✅ **Git history** — Full point-in-time recovery via Git commits  
✅ **Selective ignore** — `.env`, secrets, and temporary files never committed  
✅ **Minimal disk usage** — Only changed files are stored in Git  
✅ **Simple restore** — One command to restore any agent to any point  
✅ **Test coverage** — >80% covered, production-ready

## What Gets Backed Up

For each agent, the skill backs up:

- **Workspace** — Identity files (SOUL.md, USER.md, IDENTITY.md), memory (MEMORY.md, memory/), configuration, tools
- **Agent directory** — Session files, auth profiles, history (when available)

What's **not** backed up (by design):

- `.env*` files (use these for secrets)
- `auth-profiles.json` (sensitive auth data)
- `node_modules/`, build artifacts, logs

## API

### Backup

```typescript
import { performBackup } from '@dambrogia/openclaw-agents-backup';

const result = await performBackup('/root/.openclaw/workspace');

/*
{
  success: true,
  message: "Backed up 3 agents. Changes: 2",
  agentsProcessed: 3,
  changes: [
    { agentId: 'main', workspaceChanged: true, agentDirChanged: false },
    { agentId: 'worker-1', workspaceChanged: false, agentDirChanged: true },
    { agentId: 'worker-2', workspaceChanged: false, agentDirChanged: false }
  ]
}
*/
```

### Restore

```typescript
import { performRestore } from '@dambrogia/openclaw-agents-backup';

// Restore latest backup
const result = await performRestore(
  '/path/to/backup-repo',
  null,
  '/root/.openclaw/workspace'
);

// Or restore to specific point in time (git SHA)
const result = await performRestore(
  '/path/to/backup-repo',
  'abc123def456',
  '/root/.openclaw/workspace'
);

/*
{
  success: true,
  message: "Successfully restored 3 agents",
  agentsRestored: 3
}
*/
```

## Backup Structure

```
my-agents-backup/
├── .git/                 # Full Git history
├── archives/
│   ├── main/
│   │   ├── agent.json    # Metadata: paths, timestamp, identity
│   │   ├── workspace/    # Synced workspace directory
│   │   └── agentDir/     # Synced agent directory
│   ├── worker-1/
│   │   ├── agent.json
│   │   ├── workspace/
│   │   └── agentDir/
│   └── ...
└── .gitignore
```

Each backup run creates one Git commit. You can browse history:

```bash
cd my-agents-backup
git log --oneline
# Restore to a specific commit
git checkout abc123def456
```

## Testing

```bash
npm test              # Run tests
npm run test:coverage # Check coverage (>80% required)
npm run lint          # ESLint check
npm run build         # TypeScript compilation
```

## Common Scenarios

### Restore an Agent After Accidental Changes

```bash
# Find the commit before the change
cd my-agents-backup
git log --oneline | head -10

# Restore that state
git checkout <commit-hash>
node -e "require('@dambrogia/openclaw-agents-backup').performRestore(...)"
```

### Back Up Before Major Changes

Run backup manually before modifying agent code or identity:

```javascript
const { performBackup } = require('@dambrogia/openclaw-agents-backup');
await performBackup('/root/.openclaw/workspace');
```

Check that files were committed in Git.

### Migrate Agents to New VPS

1. Set up new VPS with OpenClaw
2. Clone your backup repo
3. Point `.backupconfig.json` to it
4. Run restore — agents are back online

## Size Considerations

Each backup cycle syncs full agent workspaces and agent directories. Disk usage:

- **Per agent** — Size of `workspace/` + `agentDir/` directories
- **Total** — All agent directories duplicated in `archives/`
- **Git** — Only tracks changed files (size grows incrementally)

Example:
- 1 agent with 100MB workspace → ~100MB per backup
- 3 agents with 100MB each → ~300MB per backup
- Hourly backups = 7.2GB/day, ~200GB/month

Recommendation: Use a dedicated backup VPS or cloud storage for long-term retention.

## Limitations

- **Point-in-time restore via Git SHA** — Requires manual `git checkout` before calling restore
- **No encryption** — Backup repo should be private and secure
- **No compression** — Backups stored as full directory syncs in Git
- **Single backup location** — Multi-region replication not supported

## Troubleshooting

**Q: Backup runs but doesn't commit?**  
A: Check Git configuration in the backup repo:
```bash
cd /path/to/backup-repo
git config user.email "test@example.com"
git config user.name "Test"
git log --oneline  # Verify commits are created
```

**Q: Restore says "Archives directory not found"?**  
A: Run backup at least once to create the archives directory structure.

**Q: Can I back up to a remote server?**  
A: Yes! `backupRepoPath` can be a local clone of a remote repo. Configure a Git remote and push after backups:
```bash
cd /path/to/backup-repo
git remote add origin <repo-url>
git push origin main
```

## Performance

- **Backup time** — Depends on agent size and disk speed. Typical: 30s–2min per agent
- **Restore time** — Similar to backup time
- **Cron interval** — Hourly recommended; can run more/less frequently

## License

MIT — Use freely in your projects.

## Contributing

Issues, PRs, and questions welcome! Please include test cases for any changes.

---

**Made for OpenClaw multi-agent setups. Disaster recovery, made simple.**
