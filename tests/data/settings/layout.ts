export const INLINE_FIELD_COMMENT = `[tools.markdownlint.rules.MD001]
mixed=[
 {
 # Field-owned comment
 enabled=true
 },
 2
]
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
[tools.eslint.rules]
values=[
 # Item owner
 1
]
`,
        target: `[format]
indent_width=2
[tools.eslint.rules]
values=[1]
`,
        expected: `[format]
indent_width = 2

[tools.eslint.rules]
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
[tools.eslint.rules]
values=[
 # Item owner
 1
]
`,
        target: `[format]
indent_style="tab"
[tools.eslint.rules]
values=[1]
`,
        expected: `[format]
indent_style = "tab"

[tools.eslint.rules]
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
id = "team/check"
command=["bun","check.ts"]
paths=["src/**"]
stage="commit"
summary="Team check"
`,
        expected: `# Existing level
level = "all"

[[command_check]]
id = "team/check"
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
        name: `top-level record array`,
        source: `# Import rule owner
[[import_rule]]
name="core"
paths=["src/**"]
can_import = ["core"] # Limit inline
`,
        target: `import_rule = [ { name = "core", paths = [ "src/**" ], can_import = ["core"] } ]
`,
        expected: `# Import rule owner
[[import_rule]]
name = "core"
paths = ["src/**"]
# Limit inline
can_import = ["core"]
`,
    },
] as const;
