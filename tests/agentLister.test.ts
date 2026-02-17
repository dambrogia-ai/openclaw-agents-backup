import { validateAgentBinding } from '../src/agentLister';
import { AgentBinding } from '../src/types';

describe('AgentLister', () => {
  describe('validateAgentBinding', () => {
    it('should return true for valid agent binding', () => {
      const validAgent: AgentBinding = {
        id: 'main',
        identityName: 'test-identity',
        identityEmoji: '⚙️',
        identitySource: 'identity',
        workspace: '/root/.openclaw/workspace',
        agentDir: '/root/.openclaw/agents/main/agent',
        model: 'anthropic/claude-haiku-4-5',
        bindings: 0,
        isDefault: true,
        routes: ['default (no explicit rules)']
      };

      expect(validateAgentBinding(validAgent)).toBe(true);
    });

    it('should return false if id is missing', () => {
      const invalidAgent = {
        identityName: 'test-identity',
        identityEmoji: '⚙️',
        identitySource: 'identity',
        workspace: '/root/.openclaw/workspace',
        agentDir: '/root/.openclaw/agents/main/agent',
        model: 'anthropic/claude-haiku-4-5',
        bindings: 0,
        isDefault: true,
        routes: ['default (no explicit rules)']
      } as unknown as AgentBinding;

      expect(validateAgentBinding(invalidAgent)).toBe(false);
    });

    it('should return false if workspace is missing', () => {
      const invalidAgent = {
        id: 'main',
        identityName: 'test-identity',
        identityEmoji: '⚙️',
        identitySource: 'identity',
        agentDir: '/root/.openclaw/agents/main/agent',
        model: 'anthropic/claude-haiku-4-5',
        bindings: 0,
        isDefault: true,
        routes: ['default (no explicit rules)']
      } as unknown as AgentBinding;

      expect(validateAgentBinding(invalidAgent)).toBe(false);
    });

    it('should return false if agentDir is missing', () => {
      const invalidAgent = {
        id: 'main',
        identityName: 'test-identity',
        identityEmoji: '⚙️',
        identitySource: 'identity',
        workspace: '/root/.openclaw/workspace',
        model: 'anthropic/claude-haiku-4-5',
        bindings: 0,
        isDefault: true,
        routes: ['default (no explicit rules)']
      } as unknown as AgentBinding;

      expect(validateAgentBinding(invalidAgent)).toBe(false);
    });
  });
});
