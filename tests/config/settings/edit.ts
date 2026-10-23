import type { IgnoreRecord } from '#cli/types/settings/file.ts';

export const SEMGREP_IGNORE: IgnoreRecord = {
    check: 'security/semgrep',
    rule: 'js/file-system-race',
    paths: ['fixture.js'],
    reason: 'The sandbox owns its temporary files.',
};

export const SCOPE_SETTING_WRITES = [
    ['a dotted key', 'limits.file_lines = 100'],
    ['an inline table', 'limits = { file_lines = 100 }'],
] as const;

export const DATED_IGNORE = `#:schema ./.gspot/gspot.schema.json
configurations = ["bash"]
# Keep the authored expiry.
[[ignore]]
check = "bash/shellcheck"
reason = "The launcher intentionally retains word splitting."
until = 2099-05-20
`;

export const INITIAL_SETTINGS = '#:schema ./.gspot/gspot.schema.json\nconfigurations = ["bash", "naming", "format"]\n';
