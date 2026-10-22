import type { IgnoreRecord } from '#cli/types/settings/file.ts';

/** An ignore of a Semgrep rule for one file. */
export const SEMGREP_IGNORE: IgnoreRecord = {
    check: 'security/semgrep',
    rule: 'js/file-system-race',
    paths: ['fixture.js'],
    reason: 'The sandbox owns its temporary files.',
};

/** Scope settings written into a settings file that already holds settings. */
export const SCOPE_SETTING_WRITES = [
    ['a dotted key', 'limits.file_lines = 100'],
    ['an inline table', 'limits = { file_lines = 100 }'],
] as const;
export const DATED_IGNORE = `configurations = ["bash"]
# Keep the authored expiry.
[[ignore]]
check = "bash/shellcheck"
reason = "The launcher intentionally retains word splitting."
until = 2099-05-20
`;
export const INITIAL_SETTINGS = 'configurations = ["bash", "naming", "format"]\n';
