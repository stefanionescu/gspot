// The types of rules in this package.

export type RuleFile = { source: string; target: string; layer: string; kit: string; title: string };

/** A rule file before selection: its asset path, and its path inside the rules folder. */
export type RuleSource = Omit<RuleFile, 'target' | 'title'> & { path: string };

/** The [rules] table of gspot.toml: whether and where the rules install, and which to leave out. */
export type RuleSettings = {
    install: boolean;
    path: string;
    local?: string;
    exclude: string[];
    instructions?: string[];
};

/** The level of a check, a rule, or the whole policy. */
export type Level = 'recommended' | 'all';
