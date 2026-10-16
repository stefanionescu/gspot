export const INLINE_FIELD_COMMENT = `[tools.eslint]
extra={ value={ mixed=[
 {
 # Field-owned comment
 enabled=true
 },
 2
] }, reason="Reviewed native settings need these values." }
`;

export const LAYOUT_CASES = [
    {
        name: `global ignore remains global after merge`,
        source: `# Whole repository
[[ignore]]
check="docs/links"
reason="Private documentation"
`,
        target: `[[ignore]]
check="docs/links"
reason="Private documentation"
[[ignore]]
check="docs/links"
paths=["docs/**"]
reason="Private documentation"
`,
        expected: `# Whole repository
[[ignore]]
check = "docs/links"
reason = "Private documentation"
`,
    },
    {
        name: `authored space indentation`,
        source: `[format]
indent_width=2
[tools.eslint.extra]
reason = "These options exercise the written indentation."

[tools.eslint.extra.value]
values=[
 # Item owner
 1
]
`,
        target: `[format]
indent_width=2
[tools.eslint.extra]
reason = "These options exercise the written indentation."

[tools.eslint.extra.value]
values=[1]
`,
        expected: `[format]
indent_width = 2

[tools.eslint.extra]
reason = "These options exercise the written indentation."

[tools.eslint.extra.value]
values = [
  # Item owner
  1,
]
`,
    },
    {
        name: `authored tab indentation`,
        source: `[format]
indent_style="tab"
[tools.eslint.extra]
reason = "These options exercise the written indentation."

[tools.eslint.extra.value]
values=[
 # Item owner
 1
]
`,
        target: `[format]
indent_style="tab"
[tools.eslint.extra]
reason = "These options exercise the written indentation."

[tools.eslint.extra.value]
values=[1]
`,
        expected: `[format]
indent_style = "tab"

[tools.eslint.extra]
reason = "These options exercise the written indentation."

[tools.eslint.extra.value]
values = [
	# Item owner
	1,
]
`,
    },
    {
        name: `first command check record`,
        source: `# Existing level
level="all"
`,
        target: `level="all"
[[command_check]]
name = "team/check"
command=["bun","check.ts"]
paths=["src/**"]
stage="commit"
summary="Team check"
`,
        expected: `# Existing level
level = "all"

[[command_check]]
name = "team/check"
command = ["bun", "check.ts"]
paths = ["src/**"]
stage = "commit"
summary = "Team check"
`,
    },
    {
        name: `unchanged values with hand edited spacing`,
        source: `level =  "all"
test_files = [ "vendor/**",  "output/**" ]


 [hooks]\u0020
enabled= true
`,
        target: `level="all"
test_files=["vendor/**","output/**"]
[hooks]
enabled=true
`,
        expected: `level = "all"
test_files = ["vendor/**", "output/**"]

[hooks]
enabled = true
`,
    },
    {
        name: `noncontiguous tool descendants`,
        source: `# Eslint first
[tools.eslint]
import_extension = "ts"

# Ruff owner
[tools.ruff]
docstring_convention = "google"

# Eslint rules
[tools.eslint.rules]
"z/rule" = []
`,
        target: `[tools]
eslint = { import_extension = "ts", rules = { "z/rule" = [] } }
ruff = { docstring_convention = "google" }
`,
        expected: `# Eslint first
[tools.eslint]
import_extension = "ts"

# Eslint rules
[tools.eslint.rules]
"z/rule" = []

# Ruff owner
[tools.ruff]
docstring_convention = "google"
`,
    },
    {
        name: `tool subtables and records`,
        source: `# Rules owner
[tools.eslint.rules]
"z/rule" = []
"a/rule" = []

# Override owner
[[tools.eslint.override]]
paths=["src/**"]
[tools.eslint.override.rules]
"z/rule" = [] # Override inline
`,
        target: `[tools]
eslint = { rules = { "z/rule" = [], "a/rule" = [] }, override = [ { paths = [ "src/**" ], rules = { "z/rule" = [] } } ] }
`,
        expected: `# Rules owner
[tools.eslint.rules]
"a/rule" = []
"z/rule" = []

# Override owner
[[tools.eslint.override]]
paths = ["src/**"]

[tools.eslint.override.rules]
# Override inline
"z/rule" = []
`,
    },
    {
        name: `module array and subtable`,
        source: `# Architecture owner
[architecture]

# Module owner
[[architecture.module]]
name="core"
paths=["src/**"]
may_import = ["core"] # Limit inline
`,
        target: `[architecture]
module = [ { name = "core", paths = [ "src/**" ], may_import = ["core"] } ]
`,
        expected: `# Architecture owner
[architecture]

# Module owner
[[architecture.module]]
name = "core"
paths = ["src/**"]
# Limit inline
may_import = ["core"]
`,
    },
] as const;
