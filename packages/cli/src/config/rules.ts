/** The YAML front matter that opens a rule file. */
export const FRONT_MATTER = /^---\n[\s\S]*?\n---\n/u;

/** The files the managed block tells the reader to open first; they cannot be left out. */
export const FIRST_READ = ['general/engineering/agent/WORKING.md', 'general/engineering/prose/WRITING.md'];

/** The heading of each group of the index: a base folder, or the category of a configuration. */
export const RULE_AREAS: Record<string, string> = {
    general: 'Repository',
    language: 'Languages',
    framework: 'Frameworks',
    library: 'Libraries',
    tool: 'Tools',
    platform: 'Platforms',
    database: 'Databases',
};

export const CHECKS_INSTALLED =
    'Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`.';

export const RULES_ALONE =
    'These files are installed copies. Change `[agent_rules]` in `gspot.toml` and run `gspot apply`, and never edit files under the rules directory.';

/** Shared introduction and enforcement contract in each managed instruction index. */
export const INSTRUCTION_HEADING = '# Engineering Guidelines';

export const LEVEL_SUMMARY =
    'Correctness, security, accessibility, type safety, routine formatting, and declared project contracts apply at both levels.';

export const ALL_LEVEL_SUMMARY =
    'Rules about vocabulary, architecture, naming, documentation coverage, declaration order, API style, and complexity apply only at all or when the project explicitly opts into them. Neither level enables experimental or preview lint rules.';
