import type { TextRange } from '#cli/types/text.ts';
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
    managedKeys: { path: string; keys: string[] }[];
    startCommand: string;
    hasOwnTitle: boolean;
};

export type RuleSection = {
    start: number;
    end: number;
    depth: number;
    marker: TextRange | undefined;
};

export type ShippedRule = {
    source: string;
    path: string;
    group: Configuration['group'];
};
