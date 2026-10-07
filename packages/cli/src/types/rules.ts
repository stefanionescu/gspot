import type { Level } from '#cli/types/configurations.ts';
import type { RuleSettings } from '#cli/types/policy/settings.ts';

/** A selected rule's destination, final text, and path within the rules folder. */
export type RuleFile = { path: string; target: string; content: string };

/** Effective instruction policy and the same selected rule files that generation writes. */
export type InstructionInputs = { rules: RuleSettings; files: RuleFile[]; level: Level; hasChecks: boolean };
