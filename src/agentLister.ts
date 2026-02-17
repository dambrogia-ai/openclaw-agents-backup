import { AgentBinding } from './types';
import { executeCommand } from './utils';

/**
 * Query OpenClaw for all agent bindings
 */
export async function listAgents(): Promise<AgentBinding[]> {
  try {
    const output = executeCommand('openclaw agents list --bindings --json');
    const agents = JSON.parse(output) as AgentBinding[];
    return agents;
  } catch (error) {
    throw new Error(`Failed to list agents: ${error}`);
  }
}

/**
 * Validate that agent bindings have all required fields
 */
export function validateAgentBinding(agent: AgentBinding): boolean {
  const required = ['id', 'workspace', 'agentDir'];
  return required.every((field) => field in agent && agent[field as keyof AgentBinding]);
}
