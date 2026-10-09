import type { PolicyFileCase } from '#tests/types/cli/policy/file.ts';

/** Canonical sections retain the original semantic comments and native values. */
export const POLICY_FILE_CASES: PolicyFileCase[] = [
    {
        name: 'native-defaults-are-omitted',
        source: 'level="recommended"\nremoved_configurations=[]\nexclude=[]\n[hooks]\nenabled=false\npush_files="changed"\n[format]\nindent_style="space"\nindent_width=4\n',
        target: 'level="recommended"\nremoved_configurations=[]\nexclude=[]\n[hooks]\nenabled=false\npush_files="changed"\n[format]\nindent_style="space"\nindent_width=4\n',
        expected: '\n',
    },
    {
        name: 'omitted-default-removes-its-reason',
        source: 'level="all"\n[limits]\nfile_lines=300\n[reasons]\n"limits.file_lines"="Keep the native limit."\n',
        target: 'level="all"\n[limits]\nfile_lines=300\n[reasons]\n"limits.file_lines"="Keep the native limit."\n',
        expected: 'level = "all"\n',
    },
    {
        name: 'scope-restores-default-after-parent-override',
        source: '[format]\nindent_width=2\n[scope."app".format]\nindent_width=4\n[scope."app/worker".format]\nindent_width=4\n[scope."notes".format]\nindent_width=2\n',
        target: '[format]\nindent_width=2\n[scope."app".format]\nindent_width=4\n[scope."app/worker".format]\nindent_width=4\n[scope."notes".format]\nindent_width=2\n',
        expected:
            '[scope.app.format]\nindent_width = 4\n\n[scope."app/worker"]\n\n[scope.notes]\n\n[format]\nindent_width = 2\n',
    },
    {
        name: 'language-default-restores-root-limit',
        source: '[limits]\nfile_lines=500\n[scope.app.limits.python]\nfile_lines=300\n[scope."app/worker".limits.python]\nfile_lines=300\n',
        target: '[limits]\nfile_lines=500\n[scope.app.limits.python]\nfile_lines=300\n[scope."app/worker".limits.python]\nfile_lines=300\n',
        expected: '[scope.app.limits.python]\nfile_lines = 300\n\n[scope."app/worker"]\n\n[limits]\nfile_lines = 500\n',
    },
    {
        name: 'global-ignore-remains-global-after-merge',
        source: '# Whole repository\n[[ignore]]\ncheck="docs/links"\nreason="Private documentation"\n',
        target: '[[ignore]]\ncheck="docs/links"\nreason="Private documentation"\n[[ignore]]\ncheck="docs/links"\npaths=["docs/**"]\nreason="Private documentation"\n',
        expected: '# Whole repository\n[[ignore]]\ncheck = "docs/links"\nreason = "Private documentation"\n',
    },
    {
        name: 'authored-space-indentation',
        source: '[format]\nindent_width=2\n[tools.example]\nvalues=[\n # Item owner\n 1\n]\n',
        target: '[format]\nindent_width=2\n[tools.example]\nvalues=[1]\n',
        expected: '[format]\nindent_width = 2\n\n[tools.example]\nvalues = [\n  # Item owner\n  1,\n]\n',
    },
    {
        name: 'authored-tab-indentation',
        source: '[format]\nindent_style="tab"\n[tools.example]\nvalues=[\n # Item owner\n 1\n]\n',
        target: '[format]\nindent_style="tab"\n[tools.example]\nvalues=[1]\n',
        expected: '[format]\nindent_style = "tab"\n\n[tools.example]\nvalues = [\n\t# Item owner\n\t1,\n]\n',
    },
    {
        name: 'first-ignore-with-provenance',
        source: '#:schema https://generativespotting.com/schema/gspot.json\n# Copied from template team, sha256 abc.\n\n# Root owner\nlevel="all"\n',
        target: 'level="all"\n[[ignore]]\ncheck="docs/links"\npaths=["docs/**"]\nreason="Private documentation"\nuntil=2026-12-31\n',
        expected:
            '#:schema https://generativespotting.com/schema/gspot.json\n# Copied from template team, sha256 abc.\n\n# Root owner\nlevel = "all"\n\n[[ignore]]\ncheck = "docs/links"\npaths = ["docs/**"]\nreason = "Private documentation"\nuntil = 2026-12-31\n',
    },
    {
        name: 'first-command-check-map',
        source: '# Existing level\nlevel="all"\n',
        target: 'level="all"\n[check."team/check"]\ncommand=["bun","check.ts"]\npaths=["src/**"]\nstage="source"\nsummary="Team check"\n',
        expected:
            '# Existing level\nlevel = "all"\n\n[check."team/check"]\ncommand = ["bun", "check.ts"]\npaths = ["src/**"]\nstage = "source"\nsummary = "Team check"\n',
    },
    {
        name: 'first-generated-array-section',
        source: '# Root owner\nlevel="all"\n',
        target: 'level="all"\n[[generated]]\npaths=["src/generated/**"]\ncommand=["bun","generate.ts"]\n',
        expected:
            '# Root owner\nlevel = "all"\n\n[[generated]]\ncommand = ["bun", "generate.ts"]\npaths = ["src/generated/**"]\n',
    },
    {
        name: 'unchanged-values-with-hand-edited-spacing',
        source: 'level =  "all"\nexclude = [ "vendor/**",  "output/**" ]\n\n\n [hooks] \nenabled= true\n',
        target: 'level="all"\nexclude=["vendor/**","output/**"]\n[hooks]\nenabled=true\n',
        expected: 'level = "all"\nexclude = ["vendor/**", "output/**"]\n\n[hooks]\nenabled = true\n',
    },
    {
        name: 'noncontiguous-tool-descendants',
        source: '# Eslint first\n[tools.eslint]\nthreads=2\n\n# Ruff owner\n[tools.ruff]\npreview=false\n\n# Eslint rules\n[tools.eslint.rules]\n"z/rule"="error"\n',
        target: '[tools]\neslint = { threads = 2, rules = { "z/rule" = "error" } }\nruff = { preview = false }\n',
        expected:
            '# Eslint first\n[tools.eslint]\nthreads = 2\n\n# Eslint rules\n[tools.eslint.rules]\n"z/rule" = "error"\n\n# Ruff owner\n[tools.ruff]\npreview = false\n',
    },
    {
        name: 'tool-subtables-and-records',
        source: '# Rules owner\n[tools.eslint.rules]\n"z/rule"="error"\n"a/rule"="warn"\n\n# Override owner\n[[tools.eslint.overrides]]\npaths=["src/**"]\n[tools.eslint.overrides.rules]\n"z/rule"="off" # Override inline\n',
        target: '[tools]\neslint = { rules = { "z/rule" = "error", "a/rule" = "warn" }, overrides = [ { paths = [ "src/**" ], rules = { "z/rule" = "off" } } ] }\n',
        expected:
            '# Override owner\n[[tools.eslint.overrides]]\npaths = ["src/**"]\n\n[tools.eslint.overrides.rules]\n# Override inline\n"z/rule" = "off"\n\n# Rules owner\n[tools.eslint.rules]\n"a/rule" = "warn"\n"z/rule" = "error"\n',
    },
    {
        name: 'unowned-prose-before-deleted-key',
        source: 'level="all"\n\n# Free regional note\n\n# Second regional note\n\nrunner="bun" # Deleted inline\n\n# Hooks owner\n[hooks]\nenabled=true\n',
        target: 'level = "all"\n\n[hooks]\nenabled = true\n',
        expected:
            'level = "all"\n\n# Free regional note\n\n# Second regional note\n\n# Hooks owner\n[hooks]\nenabled = true\n',
    },
    {
        name: 'inline-comment-column-gap',
        source: '[[ignore]]\ncheck="a/check"\npaths=["a.ts"]\nreason="Reason" # Authored reason\nuntil=2026-12-31\n',
        target: '[[ignore]]\ncheck = "a/check"\npaths = [ "a.ts" ]\nreason = "Reason"\nuntil = 2026-12-31\n',
        expected:
            '[[ignore]]\ncheck = "a/check"\npaths = ["a.ts"]\n# Authored reason\nreason = "Reason"\nuntil = 2026-12-31\n',
    },
    {
        name: 'maps-dotted-and-blank-lines',
        source: '# schema note\n# Copied from template team, sha256 abc.\n#:schema https://generativespotting.com/schema/gspot.json\n\n# Root\nlevel="all" # Level inline\n# Dotted hook\nhooks.enabled=true\n\n\n# Z scope\n[scope."z/app"]\nrunner="bun"\n\n# A check\n[check."a/task"]\nsummary="Old task" # Summary inline\n\n# A scope\n[scope."a/app"]\nrunner="node"\n',
        target: 'level = "all"\n\n[scope]\n"z/app" = { runner = "bun" }\n"a/app" = { runner = "node" }\n\n[hooks]\nenabled = true\n\n[check]\n"a/task" = { summary = "Changed task" }\n',
        expected:
            '#:schema https://generativespotting.com/schema/gspot.json\n# Copied from template team, sha256 abc.\n\n# schema note\n\n# Root\n# Level inline\nlevel = "all"\n\n# A scope\n[scope."a/app"]\nrunner = "node"\n\n# Z scope\n[scope."z/app"]\nrunner = "bun"\n\n[hooks]\n# Dotted hook\nenabled = true\n\n# A check\n[check."a/task"]\n# Summary inline\nsummary = "Changed task"\n',
    },
    {
        name: 'merged-ignores-date-array-comments',
        source: '#:schema https://generativespotting.com/schema/gspot.json\n# Copied from template team, sha256 abc.\n\n# First ignore\n[[ignore]] # First header inline\ncheck="z/check"\npaths=[\n # A path\n "a.ts", # A inline\n]\nreason="Reason"\n\n[words]\nterm="Term"\n\n# Second ignore\n[[ignore]] # Second header inline\ncheck="z/check"\npaths=[\n # B path\n "b.ts"\n]\nreason="Reason"\n',
        target: '[words]\nterm = "Term"\n\n[[ignore]]\ncheck = "z/check"\npaths = [ "a.ts" ]\nreason = "Reason"\nuntil = 2026-12-31\n\n[[ignore]]\ncheck = "z/check"\npaths = [ "b.ts" ]\nreason = "Reason"\nuntil = 2026-12-31\n',
        expected:
            '#:schema https://generativespotting.com/schema/gspot.json\n# Copied from template team, sha256 abc.\n\n[words]\nterm = "Term"\n\n# First ignore\n# First header inline\n# Second ignore\n# Second header inline\n[[ignore]]\ncheck = "z/check"\npaths = [\n    # A path\n    # A inline\n    "a.ts",\n    # B path\n    "b.ts",\n]\nreason = "Reason"\nuntil = 2026-12-31\n',
    },
    {
        name: 'split-ignore-row',
        source: '# Original physical row\n[[ignore]]\ncheck="a/check"\npaths=[\n # Split A\n "a.ts", # Split A inline\n # Split B\n "b.ts" # Split B inline\n]\nreason="Reason" # Authored reason\n',
        target: '[[ignore]]\ncheck = "a/check"\npaths = [ "a.ts" ]\nreason = "Reason"\nuntil = 2026-10-10\n\n[[ignore]]\ncheck = "a/check"\npaths = [ "b.ts" ]\nreason = "Reason"\nuntil = 2026-12-31\n',
        expected:
            '# Original physical row\n[[ignore]]\ncheck = "a/check"\npaths = [\n    # Split A\n    # Split A inline\n    "a.ts",\n]\n# Authored reason\nreason = "Reason"\nuntil = 2026-10-10\n\n[[ignore]]\ncheck = "a/check"\npaths = [\n    # Split B\n    # Split B inline\n    "b.ts",\n]\nreason = "Reason"\nuntil = 2026-12-31\n',
    },
    {
        name: 'delete-array-items-and-free-prose',
        source: '# Global note\n\n# Exclusions\nexclude=[\n # Keep A\n "a/**", # A inline\n # Delete B\n "b/**", # B inline\n # Keep C\n "c/**"\n] # Array inline\n\n# Free prose\n\n[hooks]\nenabled=true\n',
        target: 'exclude = [ "a/**", "c/**" ]\n\n[hooks]\nenabled = true\n',
        expected:
            '# Global note\n\n# Exclusions\n# Array inline\nexclude = [\n    # Keep A\n    # A inline\n    "a/**",\n    # Keep C\n    "c/**",\n]\n\n# Free prose\n\n[hooks]\nenabled = true\n',
    },
    {
        name: 'native-inline-and-unicode-maps',
        source: '# Native options\n[tools.example]\nverbatim={a=1,b=["x","y"]} # Native inline\n\n# Unicode scope\n[scope."apps/前言"]\nrunner="bun"\n\n[words]\nterm="""First line\n# String data\nLast line""" # Term inline\n',
        target: '[scope]\n"apps/前言" = { runner = "bun" }\n\n[words]\nterm = "First line\\n# String data\\nLast line"\n\n[tools]\nexample = { verbatim = { a = 1, b = [ "x", "y" ] } }\n',
        expected:
            '# Unicode scope\n[scope."apps/前言"]\nrunner = "bun"\n\n[words]\n# Term inline\nterm = "First line\\n# String data\\nLast line"\n\n# Native options\n[tools.example]\n\n# Native inline\n[tools.example.verbatim]\na = 1\nb = ["x", "y"]\n',
    },
    {
        name: 'module-array-and-subtable',
        source: '# Architecture owner\n[architecture]\n\n# Module owner\n[[architecture.modules]]\nname="core"\npaths=["src/**"]\n[architecture.modules.limits]\nfile_lines=500 # Limit inline\n',
        target: '[architecture]\nmodules = [ { name = "core", paths = [ "src/**" ], limits = { file_lines = 600 } } ]\n',
        expected:
            '# Architecture owner\n[architecture]\n\n# Module owner\n[[architecture.modules]]\nname = "core"\npaths = ["src/**"]\n\n[architecture.modules.limits]\n# Limit inline\nfile_lines = 600\n',
    },
    {
        name: 'nested-arrays',
        source: '[tools.example]\nverbatim={ values=[\n # First group\n [\n # First number\n 1, # First inline\n 2\n ], # First group inline\n # Second group\n [\n # Last number\n 3\n ]\n] }\n',
        target: '[tools.example]\nverbatim={ values=[\n # First group\n [\n # First number\n 1, # First inline\n 2\n ], # First group inline\n # Second group\n [\n # Last number\n 3\n ]\n] }\n',
        expected:
            '[tools.example.verbatim]\nvalues = [\n    # First group\n    # First group inline\n    [\n        # First number\n        # First inline\n        1,\n        2,\n    ],\n    # Second group\n    [\n        # Last number\n        3,\n    ],\n]\n',
    },
    {
        name: 'mixed-array',
        source: '[tools.example]\nverbatim={ values=[\n # A table\n {a=[\n # Nested table number\n 1\n ]},\n # A scalar\n 2\n] }\n',
        target: '[tools.example]\nverbatim={ values=[\n # A table\n {a=[\n # Nested table number\n 1\n ]},\n # A scalar\n 2\n] }\n',
        expected:
            '[tools.example.verbatim]\nvalues = [\n    # A table\n    { a = [\n        # Nested table number\n        1,\n    ] },\n    # A scalar\n    2,\n]\n',
    },
    {
        name: 'inline-field',
        source: '[tools.example]\nverbatim={\n # Field comment\n values=[1,2]\n }\n',
        target: '[tools.example]\nverbatim={\n # Field comment\n values=[1,2]\n }\n',
        expected: '[tools.example.verbatim]\n# Field comment\nvalues = [1, 2]\n',
    },
    {
        name: 'same-date-rows',
        source: '# A row\n[[ignore]]\ncheck="a/check"\npaths=["a.ts"]\nreason="Reason"\nuntil=2026-10-01\n\n# B row\n[[ignore]]\ncheck="a/check"\npaths=["b.ts"]\nreason="Reason"\nuntil=2026-11-01\n',
        target: '# A row\n[[ignore]]\ncheck="a/check"\npaths=["a.ts"]\nreason="Reason"\nuntil=2026-10-01\n\n# B row\n[[ignore]]\ncheck="a/check"\npaths=["b.ts"]\nreason="Reason"\nuntil=2026-11-01\n',
        expected:
            '# A row\n[[ignore]]\ncheck = "a/check"\npaths = ["a.ts"]\nreason = "Reason"\nuntil = 2026-10-01\n\n# B row\n[[ignore]]\ncheck = "a/check"\npaths = ["b.ts"]\nreason = "Reason"\nuntil = 2026-11-01\n',
    },
];

/** An explicit empty project path keeps repository inference disabled. */
export const EMPTY_PROJECT_POLICY = 'configurations = ["swift", "xcode"]\n[swift]\nxcode_project = ""\n';

/** Native expiry remains mutable while the captured value identity stays unchanged. */
export const NATIVE_EDIT_POLICY =
    'configurations = ["bash"]\n# Keep the authored expiry.\n[[ignore]]\ncheck = "bash/shellcheck"\nreason = "The launcher intentionally retains word splitting."\nuntil = 2099-05-20\n';
