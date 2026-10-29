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
