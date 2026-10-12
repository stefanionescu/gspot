import type { Level, Manifest } from '#cli/types/configurations.ts';

/** The [rules] table after default expansion. */
export type RulesSettings = { enabled: boolean; exclude: string[]; instruction_files: string[] };

/** A selected rule's destination, final text, and path within the rules folder. */
export type RuleFile = {
    path: string;
    target: string;
    content: string;
    group: Manifest['configuration']['group'];
};

/** Effective instruction settings and the same selected rule files that generation writes. */
export type ManagedBlockValues = {
    files: RuleFile[];
    generatedPaths: string[];
    level: Level;
    hasChecks: boolean;
    startCommand: string;
};

/** One Markdown heading's source range, depth, and all-level marker. */
export type RuleSection = { start: number; end: number; depth: number; all: boolean };

/** A shipped rule asset and its path before selection. */
export type RuleSource = {
    source: string;
    path: string;
    group: Manifest['configuration']['group'];
};
