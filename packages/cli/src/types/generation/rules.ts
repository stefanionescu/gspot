import type { Configuration } from '#cli/types/configurations.ts';

/** The destination, final text, and path in the rules folder of one rule. */
export type RuleFile = {
    path: string;
    target: string;
    content: string;
    scopes: string[];
    group: Configuration['group'];
};

/** The rule settings, and the rule files that generation writes. */
export type AgentsBlockContent = {
    files: RuleFile[];
    generatedPaths: string[];
    managedKeys: { path: string; keys: string[] }[];
    hasChecks: boolean;
    startCommand: string;
    hasOwnTitle: boolean;
};

/** The source range, depth, and all-level marker of one Markdown heading. */
export type RuleSection = { start: number; end: number; depth: number; all: boolean };

/** A shipped rule asset and its path before selection. */
export type ShippedRule = {
    source: string;
    path: string;
    group: Configuration['group'];
};
