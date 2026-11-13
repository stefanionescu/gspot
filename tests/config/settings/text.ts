// field comments
export const FIELD_COMMENT_CASES = [
    {
        name: 'first ignore',
        source: '# Root owner\nlevel="all"\n',
        target: 'level="all"\n[[ignore]]\ncheck="docs/links"\npaths=["docs/**"]\nreason="Private documentation"\n',
        expected:
            '# Root owner\nlevel="all"\n\n[[ignore]]\ncheck = "docs/links"\npaths = ["docs/**"]\nreason = "Private documentation"\n',
    },
    {
        name: 'unowned prose before deleted key',
        source: 'level="all"\n\n# Free regional note\n\n# Second regional note\n\ntool_timeout_seconds=600 # Deleted inline\n\n# Hooks owner\n[hooks]\nenabled=true\n',
        target: 'level = "all"\n\n[hooks]\nenabled = true\n',
        expected:
            'level="all"\n\n# Free regional note\n\n# Second regional note\n\n\n# Hooks owner\n[hooks]\nenabled=true\n',
    },
    {
        name: 'maps dotted and blank lines',
        source: '# schema note\n# Root\nlevel="all" # Level inline\n# Dotted hook\nhooks.enabled=true\n\n# Z scope\n[[scope]]\npath="z/app"\n\n# A check\n[[command_check]]\nid="a/task"\ncommand=["bun","task.ts"]\npaths=["src/**"]\nstage="manual"\nsummary="Old task" # Summary inline\n\n# A scope\n[[scope]]\npath="a/app"\n',
        target: 'level="all"\nhooks.enabled=true\n[[scope]]\npath="z/app"\n[[scope]]\npath="a/app"\n[[command_check]]\nid="a/task"\ncommand=["bun","task.ts"]\npaths=["src/**"]\nstage="manual"\nsummary="Changed task"\n',
        expected:
            '# schema note\n# Root\nlevel="all" # Level inline\n# Dotted hook\nhooks.enabled=true\n\n# Z scope\n[[scope]]\npath="z/app"\n\n# A check\n[[command_check]]\nid="a/task"\ncommand=["bun","task.ts"]\npaths=["src/**"]\nstage="manual"\nsummary="Changed task" # Summary inline\n\n# A scope\n[[scope]]\npath="a/app"\n',
    },
];

// settings edits
export const INITIAL_SETTINGS = 'configurations = ["bash", "naming", "format"]\n';
export const SCOPE_SETTING_WRITES = [
    ['a dotted key', 'limits.max_file_lines = 100'],
    ['an inline table', 'limits = { max_file_lines = 100 }'],
] as const;
export const SEMGREP_IGNORE = {
    check: 'security/semgrep',
    rule: 'js/file-system-race',
    paths: ['sample.js'],
    reason: 'The sandbox owns its temporary files.',
};
