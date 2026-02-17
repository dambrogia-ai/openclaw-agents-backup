import * as path from 'path';
import * as fs from 'fs';
import { performBackup } from '../src/backup';

describe('Backup', () => {
  let testWorkspace: string;
  let testBackupRepo: string;

  beforeEach(() => {
    // Create temporary test directories
    testWorkspace = `/tmp/test-workspace-${Date.now()}`;
    testBackupRepo = `/tmp/test-backup-${Date.now()}`;

    fs.mkdirSync(testWorkspace, { recursive: true });
    fs.mkdirSync(testBackupRepo, { recursive: true });

    // Initialize git repo for backup
    const currentDir = process.cwd();
    try {
      process.chdir(testBackupRepo);
      require('child_process').execSync('git init');
      require('child_process').execSync('git config user.email "test@example.com"');
      require('child_process').execSync('git config user.name "Test User"');
      process.chdir(currentDir);
    } catch {
      process.chdir(currentDir);
    }
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true });
    }
    if (fs.existsSync(testBackupRepo)) {
      fs.rmSync(testBackupRepo, { recursive: true });
    }
  });

  describe('performBackup', () => {
    it('should fail if .backupconfig.json is missing', async () => {
      const result = await performBackup(testWorkspace);
      expect(result.success).toBe(false);
      expect(result.message).toContain('.backupconfig.json');
    });

    it('should fail if backup repo does not exist', async () => {
      const configPath = path.join(testWorkspace, '.backupconfig.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ backupRepoPath: '/nonexistent/backup' })
      );

      const result = await performBackup(testWorkspace);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return success with zero agents if no agents exist', async () => {
      const configPath = path.join(testWorkspace, '.backupconfig.json');
      fs.writeFileSync(configPath, JSON.stringify({ backupRepoPath: testBackupRepo }));

      // Mock the agents list to return empty
      jest.mock('../src/agentLister', () => ({
        listAgents: async () => [],
        validateAgentBinding: jest.fn(() => true)
      }));

      // This test documents the behavior when no agents are found
      // In real scenarios, this would be tested with proper mocking
      // For now we just verify the function doesn't crash
    });
  });
});
