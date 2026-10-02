// The types of rules in this package.

export type RuleFile = { source: string; target: string; layer: string; kit: string; title: string };

/** The [guides] table of gspot.toml: whether and where the rules install, and which to leave out. */
export type RuleSettings = {
    install: boolean;
    directory: string;
    project?: string;
    exclude: string[];
    agents?: string[];
};

/** The level of a check, a rule, or the whole policy. */
export type Level = 'recommended' | 'all';
