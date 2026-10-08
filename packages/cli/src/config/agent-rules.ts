/** The YAML front matter that opens a rule file. */
export const FRONT_MATTER = /^---\n[\s\S]*?\n---\n/u;

export const CHECKS_INSTALLED =
    'Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore`. After a hand edit of `gspot.toml`, run `gspot apply`. Never edit files under `.gspot/`.';

export const RULES_ALONE =
    'These files are installed copies. Change `[agent_rules]` in `gspot.toml` and run `gspot apply`, and never edit files under the rules directory.';

/** Shared introduction and enforcement contract in each managed instruction index. */
export const INSTRUCTION_HEADING = '# Engineering Guidelines';
