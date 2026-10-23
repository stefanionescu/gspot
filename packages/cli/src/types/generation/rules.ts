import type { Configuration } from '#cli/types/configurations.ts';

export type RuleFile = {
    path: string;
    target: string;
    content: string;
    scopes: string[];
    group: Configuration['group'];
};

export type AgentsBlockContent = {
    files: RuleFile[];
    generatedPaths: string[];
    managedKeys: { path: string; keys: string[] }[];
    hasChecks: boolean;
    startCommand: string;
    hasOwnTitle: boolean;
};

export type RuleSection = {
    start: number;
    end: number;
    depth: number;
    marker: { start: number; end: number } | undefined;
};

export type ShippedRule = {
    source: string;
    path: string;
    group: Configuration['group'];
};
