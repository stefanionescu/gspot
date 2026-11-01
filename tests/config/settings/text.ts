export const SEMGREP_IGNORE = {
    check: 'security/semgrep',
    rule: 'js/file-system-race',
    paths: ['sample.js'],
    reason: 'The sandbox owns its temporary files.',
};

export const SCOPE_SETTING_WRITES = [
    ['a dotted key', 'limits.max_file_lines = 100'],
    ['an inline table', 'limits = { max_file_lines = 100 }'],
] as const;

export const INITIAL_SETTINGS = 'configurations = ["bash", "naming", "format"]\n';

export const ARRAY_COMMENT_CASES = [
    {
        name: 'delete array items and free prose',
        source: '# Global note\n\n# Exclusions\ntest_files=[\n # Keep A\n "a/**", # A inline\n # Delete B\n "b/**", # B inline\n # Keep C\n "c/**"\n] # Array inline\n\n# Free prose\n\n[hooks]\nenabled=true\n',
        target: 'test_files = [ "a/**", "c/**" ]\n\n[hooks]\nenabled = true\n',
        expected:
            '# Global note\n\n# Exclusions\ntest_files=[\n # Keep A\n "a/**", # A inline\n # Keep C\n # Delete B\n# B inline\n"c/**"\n] # Array inline\n\n# Free prose\n\n[hooks]\nenabled=true\n',
    },
    {
        name: 'nested arrays',
        source: '[tools.eslint.rules]\nvalues=[\n # First group\n [\n # First number\n 1, # First inline\n 2\n ], # First group inline\n # Second group\n [\n # Last number\n 3\n ]\n]\n',
        expected:
            '[tools.eslint.rules]\nvalues=[\n # First group\n [\n # First number\n 1, # First inline\n 2\n ], # First group inline\n # Second group\n [\n # Last number\n 3\n ]\n]\n',
    },
    {
        name: 'mixed array',
        source: '[tools.eslint.rules]\nvalues=[\n # A table\n {a=[\n # Nested table number\n 1\n ]},\n # A scalar\n 2\n]\n',
        expected:
            '[tools.eslint.rules]\nvalues=[\n # A table\n {a=[\n # Nested table number\n 1\n ]},\n # A scalar\n 2\n]\n',
    },
];

export const FIELD_COMMENT_CASES = [
    {
        name: 'unowned prose before deleted key',
        source: 'level="all"\n\n# Free regional note\n\n# Second regional note\n\ntool_timeout_seconds=600 # Deleted inline\n\n# Hooks owner\n[hooks]\nenabled=true\n',
        target: 'level = "all"\n\n[hooks]\nenabled = true\n',
        expected:
            'level="all"\n\n# Free regional note\n\n# Second regional note\n\n\n# Hooks owner\n[hooks]\nenabled=true\n',
    },
    {
        name: 'inline comment column gap',
        source: '[[ignore]]\ncheck="a/check"\npaths=["a.ts"]\nreason="Reviewed findings stay ignored intentionally." # Authored reason\nuntil=2026-12-31\n',
        target: '[[ignore]]\ncheck = "a/check"\npaths = [ "a.ts" ]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n',
        expected:
            '[[ignore]]\ncheck="a/check"\npaths=["a.ts"]\nreason="Reviewed findings stay ignored intentionally." # Authored reason\nuntil=2026-12-31\n',
    },
    {
        name: 'maps dotted and blank lines',
        source: '# schema note\n# Root\nlevel="all" # Level inline\n# Dotted hook\nhooks.enabled=true\n\n# Z scope\n[[scope]]\npath="z/app"\n\n# A check\n[[command_check]]\nid="a/task"\ncommand=["bun","task.ts"]\npaths=["src/**"]\nstage="manual"\nsummary="Old task" # Summary inline\n\n# A scope\n[[scope]]\npath="a/app"\n',
        target: 'level="all"\nhooks.enabled=true\n[[scope]]\npath="z/app"\n[[scope]]\npath="a/app"\n[[command_check]]\nid="a/task"\ncommand=["bun","task.ts"]\npaths=["src/**"]\nstage="manual"\nsummary="Changed task"\n',
        expected:
            '# schema note\n# Root\nlevel="all" # Level inline\n# Dotted hook\nhooks.enabled=true\n\n# Z scope\n[[scope]]\npath="z/app"\n\n# A check\n[[command_check]]\nid="a/task"\ncommand=["bun","task.ts"]\npaths=["src/**"]\nstage="manual"\nsummary="Changed task" # Summary inline\n\n# A scope\n[[scope]]\npath="a/app"\n',
    },
    {
        name: 'inline tool options and Unicode tables',
        source: '# Native options\n[tools.eslint.rules]\noptions = [{a=1,b=["x","y"],note="""First line\n# String data\nLast line"""}] # Native inline\n\n# Unicode scope\n[[scope]]\npath="apps/前言"\nconfigurations=[]\n',
        target: '[tools.eslint.rules]\noptions = [{a=1,b=["x","y"],note="First line\\n# String data\\nLast line"}]\n[[scope]]\npath="apps/前言"\nconfigurations=[]\n',
        expected:
            '# Native options\n[tools.eslint.rules]\noptions = [{a=1,b=["x","y"],note="""First line\n# String data\nLast line"""}] # Native inline\n\n# Unicode scope\n[[scope]]\npath="apps/前言"\nconfigurations=[]\n',
    },
    {
        name: 'inline field',
        source: '[tools.eslint.rules]\n # Field comment\n values=[1,2]\n',
        expected: '[tools.eslint.rules]\n # Field comment\n values=[1,2]\n',
    },
];

export const IGNORE_COMMENT_CASES = [
    {
        name: 'first ignore',
        source: '# Root owner\nlevel="all"\n',
        target: 'level="all"\n[[ignore]]\ncheck="docs/links"\npaths=["docs/**"]\nreason="Private documentation"\nuntil=2026-12-31\n',
        expected:
            '# Root owner\nlevel="all"\n\n[[ignore]]\ncheck = "docs/links"\npaths = ["docs/**"]\nreason = "Private documentation"\nuntil = 2026-12-31\n',
    },
    {
        name: 'merged ignores date array comments',
        source: 'spelling.allowed_words={BannedWord="The project uses this reviewed name."}\n\n# First ignore\n[[ignore]] # First header inline\ncheck="z/check"\npaths=[\n # A path\n "a.ts", # A inline\n]\nreason="Reviewed findings stay ignored intentionally."\n\n# Second ignore\n[[ignore]] # Second header inline\ncheck="z/check"\npaths=[\n # B path\n "b.ts"\n]\nreason="Reviewed findings stay ignored intentionally."\n',
        target: 'spelling.allowed_words={BannedWord="The project uses this reviewed name."}\n\n[[ignore]]\ncheck = "z/check"\npaths = [ "a.ts" ]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n\n[[ignore]]\ncheck = "z/check"\npaths = [ "b.ts" ]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n',
        expected:
            'spelling.allowed_words={BannedWord="The project uses this reviewed name."}\n\n# First ignore\n[[ignore]] # First header inline\ncheck="z/check"\npaths=[\n # A path\n "a.ts", # A inline\n]\nreason="Reviewed findings stay ignored intentionally."\n\nuntil = 2026-12-31\n# Second ignore\n[[ignore]] # Second header inline\ncheck="z/check"\npaths=[\n # B path\n "b.ts"\n]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n',
    },
    {
        name: 'split ignore row',
        source: '# Original physical row\n[[ignore]]\ncheck="a/check"\npaths=[\n # Split A\n "a.ts", # Split A inline\n # Split B\n "b.ts" # Split B inline\n]\nreason="Reviewed findings stay ignored intentionally." # Authored reason\n',
        target: '[[ignore]]\ncheck = "a/check"\npaths = [ "a.ts" ]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-10-10\n\n[[ignore]]\ncheck = "a/check"\npaths = [ "b.ts" ]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n',
        expected:
            '# Original physical row\n[[ignore]]\ncheck="a/check"\npaths=[\n # Split A\n "a.ts"  # Split A inline\n]\nreason="Reviewed findings stay ignored intentionally." # Authored reason\nuntil = 2026-10-10\n\n[[ignore]]\ncheck = "a/check"\npaths = ["b.ts"]\nreason = "Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n',
    },
    {
        name: 'same date rows',
        source: '# A row\n[[ignore]]\ncheck="a/check"\npaths=["a.ts"]\nreason="Reviewed findings stay ignored intentionally."\nuntil=2026-10-01\n\n# B row\n[[ignore]]\ncheck="a/check"\npaths=["b.ts"]\nreason="Reviewed findings stay ignored intentionally."\nuntil=2026-11-01\n',
        expected:
            '# A row\n[[ignore]]\ncheck="a/check"\npaths=["a.ts"]\nreason="Reviewed findings stay ignored intentionally."\nuntil=2026-10-01\n\n# B row\n[[ignore]]\ncheck="a/check"\npaths=["b.ts"]\nreason="Reviewed findings stay ignored intentionally."\nuntil=2026-11-01\n',
    },
];
