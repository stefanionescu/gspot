import type { z } from 'zod';
import type { Level } from '#cli/types/configurations.ts';
import type { agentRulesValuesSchema } from '#cli/policy/schema/agent-rules.ts';

/** The [agent_rules] table after native execution defaults are resolved. */
export type AgentRules = z.output<typeof agentRulesValuesSchema>;

/** A selected rule's destination, final text, and path within the rules folder. */
export type RuleFile = { path: string; target: string; content: string };

/** Effective instruction policy and the same selected rule files that generation writes. */
export type InstructionInputs = { rules: AgentRules; files: RuleFile[]; level: Level; hasChecks: boolean };
