import { AI_MODE } from '../constants/index.js';
import type { AiMode, ModeOverride } from '../constants/index.js';
import type { IChatSettings, IAiCharacterProfile } from '../schemas/chat-settings.schema.js';
import type { IChatAgent } from '../schemas/chat-agent.schema.js';

/**
 * Two-layer AI mode resolution.
 *
 * Layer 1 — global setting (`settings.aiMode`):
 *   - `manual`     → force all agents to manual
 *   - `ai`         → force all agents to AI
 *   - `agent-wise` → defer to per-agent `modeOverride`
 *
 * Layer 2 — per-agent (`agent.modeOverride`):
 *   - Only consulted when `settings.aiMode === 'agent-wise'`
 *   - Falls back to `'manual'` when the agent has no override set
 */
export function resolveAiMode(
  settings: Pick<IChatSettings, 'aiMode'>,
  agent?: Pick<IChatAgent, 'modeOverride'> | null,
): 'ai' | 'manual' {
  const globalMode: AiMode = settings.aiMode ?? AI_MODE.AgentWise;

  if (globalMode === AI_MODE.Manual) return 'manual';
  if (globalMode === AI_MODE.AI) return 'ai';

  // agent-wise: consult per-agent modeOverride
  const agentOverride: ModeOverride | null | undefined = agent?.modeOverride;
  return agentOverride === 'ai' ? 'ai' : 'manual';
}

/**
 * Resolve AI character/persona for a session.
 *
 * Priority:
 *   1. Agent-level `aiCharacter` (if set)
 *   2. Global `settings.aiCharacter.globalCharacter`
 *   3. `null` (no character configured)
 */
export function resolveAiCharacter(
  settings: Pick<IChatSettings, 'aiCharacter'>,
  agent?: Pick<IChatAgent, 'aiCharacter'> | null,
): IAiCharacterProfile | null {
  if (agent?.aiCharacter) return agent.aiCharacter;
  return settings.aiCharacter?.globalCharacter ?? null;
}
