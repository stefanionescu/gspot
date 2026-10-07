import type { z } from 'zod';
import type { Level } from '#cli/types/configurations.ts';
import type { agentRulesSchema } from '#cli/policy/schema/agent-rules.ts';

/** The [agent_rules] table of gspot.toml. */
export type AgentRules = z.output<typeof agentRulesSchema>;

/** A selected rule's destination, final text, and path within the rules folder. */
export type RuleFile = { path: string; target: string; content: string };

/** Effective instruction policy and the same selected rule files that generation writes. */
export type InstructionInputs = { rules: AgentRules; files: RuleFile[]; level: Level; hasChecks: boolean };
