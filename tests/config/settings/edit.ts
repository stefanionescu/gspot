export const SEMGREP_IGNORE = {
    check: 'security/semgrep',
    rule: 'js/file-system-race',
    paths: ['sample.js'],
    reason: 'The sandbox owns its temporary files.',
};

export const SCOPE_SETTING_WRITES = [
    ['a dotted key', 'limits.file_lines = 100'],
    ['an inline table', 'limits = { file_lines = 100 }'],
] as const;

export const INITIAL_SETTINGS = '#:schema ./.gspot/gspot.schema.json\nconfigurations = ["bash", "naming", "format"]\n';
