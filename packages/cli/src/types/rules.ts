import type { z } from 'zod';
import type { levelSchema } from '#cli/parsers/schema/settings.ts';
import type { agentRulesSchema } from '#cli/parsers/schema/agent-rules.ts';

/** A selected rule's destination, final text, and path within the rules folder. */
export type RuleFile = { path: string; target: string; content: string };

/** A rule asset and its path inside the rules folder before selection. */
export type RuleSource = { source: string; path: string };

/** An invalid rule exclusion at its position in the authored list. */
export type RuleExclusionProblem = { index: number; message: string };

/** The [agent_rules] table of gspot.toml: whether and where the rules install, and which to leave out. */
export type RuleSettings = z.output<typeof agentRulesSchema>;

/** The level of a check, a rule, or the whole policy. */
export type Level = z.output<typeof levelSchema>;

/** Effective instruction policy and the same selected rule files that generation writes. */
export type InstructionInputs = { rules: RuleSettings; files: RuleFile[]; level: Level; hasChecks: boolean };
