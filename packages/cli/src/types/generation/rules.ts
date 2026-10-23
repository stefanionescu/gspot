import type { Configuration } from '#cli/types/configurations.ts';

/** The destination, final text, and path in the rules folder of one rule. */
export type RuleFile = {
    path: string;
    target: string;
    content: string;
    scopes: string[];
    group: Configuration['group'];
};

/** What the managed block of AGENTS.md lists: the rule files, the generated files and keys, and the start command. */
export type AgentsBlockContent = {
    files: RuleFile[];
    generatedPaths: string[];
    managedKeys: { path: string; keys: string[] }[];
    hasChecks: boolean;
    startCommand: string;
    hasOwnTitle: boolean;
};

/** The source range and depth of one Markdown heading, and the source range of its level-all marker, if any. */
export type RuleSection = {
    start: number;
    end: number;
    depth: number;
    marker: { start: number; end: number } | undefined;
};

/** A shipped rule asset and its path, before gspot chooses which rules to write. */
export type ShippedRule = {
    source: string;
    path: string;
    group: Configuration['group'];
};
