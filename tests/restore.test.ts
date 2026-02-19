import * as path from 'path';
import * as fs from 'fs';
import { performRestore } from '../src/restore';
import { AgentArchiveMetadata } from '../src/types';

describe('Restore', () => {
  let testBackupRepo: string;
  let testRestorePath: string;
  const originalEnv = process.env.BACKUP_ENCRYPTION_PASSWORD;

  beforeEach(() => {
    testBackupRepo = `/tmp/test-backup-restore-${Date.now()}`;
    testRestorePath = `/tmp/test-restore-path-${Date.now()}`;

    fs.mkdirSync(testBackupRepo, { recursive: true });
    fs.mkdirSync(testRestorePath, { recursive: true });

    // Set encryption password for tests
    process.env.BACKUP_ENCRYPTION_PASSWORD = 'test-password-12345';
  });

  afterAll(() => {
    // Restore original env
    if (originalEnv) {
      process.env.BACKUP_ENCRYPTION_PASSWORD = originalEnv;
    } else {
      delete process.env.BACKUP_ENCRYPTION_PASSWORD;
    }
  });

  afterEach(() => {
    if (fs.existsSync(testBackupRepo)) {
      fs.rmSync(testBackupRepo, { recursive: true });
    }
    if (fs.existsSync(testRestorePath)) {
      fs.rmSync(testRestorePath, { recursive: true });
    }
  });

  describe('performRestore', () => {
    it('should fail if backup repo does not exist', async () => {
      const result = await performRestore('/nonexistent/backup', null, testRestorePath);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should fail if archives directory does not exist', async () => {
      const result = await performRestore(testBackupRepo, null, testRestorePath);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Archives directory not found');
    });

    it('should return zero agents restored if no agent archives exist', async () => {
      fs.mkdirSync(path.join(testBackupRepo, 'archives'), { recursive: true });
      const result = await performRestore(testBackupRepo, null, testRestorePath);
      expect(result.success).toBe(true);
      expect(result.agentsRestored).toBe(0);
    });

    it('should handle restore when agent metadata is present', async () => {
      const archivesPath = path.join(testBackupRepo, 'archives');
      const agentPath = path.join(archivesPath, 'test-agent');
      const workspacePath = path.join(agentPath, 'workspace');

      fs.mkdirSync(workspacePath, { recursive: true });

      // Create minimal agent metadata
      const metadata: AgentArchiveMetadata = {
        id: 'test-agent',
        identityName: 'test-identity',
        identityEmoji: '⚙️',
        identitySource: 'identity',
        workspace: path.join(testRestorePath, 'workspace'),
        agentDir: path.join(testRestorePath, 'agentDir'),
        model: 'test-model',
        bindings: 0,
        isDefault: false,
        routes: [],
        backedUpAt: new Date().toISOString()
      };

      fs.writeFileSync(
        path.join(agentPath, 'agent.json'),
        JSON.stringify(metadata, null, 2)
      );

      const result = await performRestore(testBackupRepo, null, testRestorePath);
      expect(result.success).toBe(true);
      expect(result.agentsRestored).toBe(1);
    });
  });
});
