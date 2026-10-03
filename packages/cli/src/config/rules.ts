// The literal values rules reads: names, patterns, limits, and tables.

/** The folders of the base rules every repository gets, inside the rules folder of the package. */
export const BASE_RULES = ['agent', 'code', 'prose'];

/** The folder of the package, and of each kit, that holds the rule files. */
export const RULES_FOLDER = 'rules';

export const TITLE = /^# (?<title>.+)$/mu;

/** The YAML front matter that opens a rule file. */
export const FRONT_MATTER = /^---\n[\s\S]*?\n---\n/u;

/** The files the managed block tells the reader to open first; they cannot be left out. */
export const FIRST_READ = ['agent/WORKING.md', 'prose/WRITING.md'];

/** The heading of each group of the index: a base folder, or the category of a kit. */
export const AREA_BY_LAYER: Record<string, string> = {
    agent: 'How to work here',
    code: 'Code, everywhere',
    prose: 'Documentation',
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
    'These files are installed copies. Change `[rules]` in `gspot.toml` and run `gspot apply`, and never edit files under the rules directory.';
