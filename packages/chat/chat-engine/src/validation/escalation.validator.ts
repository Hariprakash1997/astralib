import type { ChatAgentDocument } from '../schemas/chat-agent.schema';
import { EscalationError } from '../errors/index.js';

/**
 * Validates that an escalation follows strict one-level-up rules:
 * - Target must be exactly one level above current agent
 * - Target must be in the same team OR be the direct supervisor (parentId)
 * - Target must be online and available
 */
export function validateEscalation(
  sessionId: string,
  currentAgent: ChatAgentDocument,
  targetAgent: ChatAgentDocument,
): void {
  const currentId = currentAgent._id.toString();
  const targetId = targetAgent._id.toString();
  const currentLevel = currentAgent.level;
  const targetLevel = targetAgent.level;

  // Target must be exactly one level above
  if (targetLevel !== currentLevel + 1) {
    throw new EscalationError(
      sessionId,
      currentId,
      String(currentLevel),
      `Target agent must be exactly one level above (expected L${currentLevel + 1}, got L${targetLevel})`,
    );
  }

  // Target must be in the same team OR be the direct supervisor
  const sameTeam = currentAgent.teamId != null && currentAgent.teamId === targetAgent.teamId;
  const directSupervisor = currentAgent.parentId != null
    && currentAgent.parentId.toString() === targetId;

  if (!sameTeam && !directSupervisor) {
    throw new EscalationError(
      sessionId,
      currentId,
      String(currentLevel),
      'Target agent must be in the same team or be the direct supervisor',
    );
  }

  // Target must be online and available
  if (!targetAgent.isOnline || !targetAgent.isActive) {
    throw new EscalationError(
      sessionId,
      currentId,
      String(currentLevel),
      'Target agent is not online or available',
    );
  }
}
