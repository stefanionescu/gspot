export const CHECKS_CLOSING =
    'Run `{start} check --staged` before you commit. To change gspot.toml, use `{start} set`, `{start} unset`, `{start} ignore`, or `{start} unignore`. After you edit gspot.toml by hand, run `{start} apply`. Never edit files under `.gspot/`{outside}. Change `gspot.toml` and run `{start} apply` instead.';

export const RULES_ONLY_CLOSING =
    'gspot writes these files. To change them, edit [rules] in gspot.toml and run `{start} apply`. Do not edit the files under the rules folder.';

export const RULES_HEADING = '# Rules';

export const FIRST_READ: ReadonlySet<string> = new Set([
    'general/engineering/agent/WORKING.md',
    'general/prose/WRITING.md',
]);

export const RULE_FILE_PATTERN = /^[A-Z0-9-]+\.md$/u;

export const AGENTS_FILE = 'AGENTS.md';

export const ALL_LEVEL_MARKER = '<!-- level: all -->';
