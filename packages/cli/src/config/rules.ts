// The literal values rules reads: names, patterns, limits, and tables.

export const AGENT_LAYERS = new Set(['general/agent', 'general/code', 'general/prose']);
export const RULES_PREFIX = 'guides/';
export const TITLE = /^# (?<title>.+)$/mu;

/** The files the managed block tells the reader to open first; they cannot be left out. */
export const FIRST_READ = ['general/agent/WORKING.md', 'general/prose/WRITING.md'];
export const AREA_BY_LAYER: Record<string, string> = {
    agent: 'How to work here',
    code: 'Code, everywhere',
    prose: 'Documentation',
    language: 'Languages',
    runtime: 'Runtimes',
    framework: 'Frameworks',
    library: 'Libraries',
    tool: 'Tools',
    platform: 'Platforms',
    database: 'Databases',
    shared: 'Shared',
    repository: 'Repository',
};
export const CHECKS_INSTALLED =
    'Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`.';
export const RULES_ALONE =
    'These files are installed copies. Change `[rules]` in `gspot.toml` and run `gspot apply`, and never edit files under the rules directory.';
