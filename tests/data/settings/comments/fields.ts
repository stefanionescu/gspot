export const FIELD_COMMENT_CASES = [
    {
        name: `unowned prose before deleted key`,
        source: `level="all"

# Free regional note

# Second regional note

tool_timeout_seconds=600 # Deleted inline

# Hooks owner
[hooks]
enabled=true
`,
        target: `level = "all"

[hooks]
enabled = true
`,
        expected: `level = "all"

# Free regional note

# Second regional note

# Hooks owner
[hooks]
enabled = true
`,
    },
    {
        name: `inline comment column gap`,
        source: `[[ignore]]
check="a/check"
paths=["a.ts"]
reason="Reviewed findings stay ignored intentionally." # Authored reason
until=2026-12-31
`,
        target: `[[ignore]]
check = "a/check"
paths = [ "a.ts" ]
reason="Reviewed findings stay ignored intentionally."
until = 2026-12-31
`,
        expected: `[[ignore]]
check = "a/check"
paths = ["a.ts"]
# Authored reason
reason = "Reviewed findings stay ignored intentionally."
until = 2026-12-31
`,
    },
    {
        name: `maps dotted and blank lines`,
        source: `# schema note
# Root
level="all" # Level inline
# Dotted hook
hooks.enabled=true

# Z scope
[[scope]]
path="z/app"

# A check
[[command_check]]
name="a/task"
command=["bun","task.ts"]
paths=["src/**"]
stage="manual"
summary="Old task" # Summary inline

# A scope
[[scope]]
path="a/app"
`,
        target: `level="all"
hooks.enabled=true
[[scope]]
path="z/app"
[[scope]]
path="a/app"
[[command_check]]
name="a/task"
command=["bun","task.ts"]
paths=["src/**"]
stage="manual"
summary="Changed task"
`,
        expected: `# schema note
# Root
# Level inline
level = "all"

[hooks]
# Dotted hook
enabled = true

# Z scope
[[scope]]
path = "z/app"

# A scope
[[scope]]
path = "a/app"

# A check
[[command_check]]
name = "a/task"
command = ["bun", "task.ts"]
paths = ["src/**"]
stage = "manual"
# Summary inline
summary = "Changed task"
`,
    },
    {
        name: `inline tool options and Unicode tables`,
        source: `# Native options
[tools.eslint.rules]
options = [{a=1,b=["x","y"],note="""First line
# String data
Last line"""}] # Native inline

# Unicode scope
[[scope]]
path="apps/前言"
configurations=[]
`,
        // eslint-disable-next-line unicorn/prefer-string-raw -- Bun escapes Unicode in raw templates and changes this TOML value.
        target: `[tools.eslint.rules]
options = [{a=1,b=["x","y"],note="First line\\n# String data\\nLast line"}]
[[scope]]
path="apps/前言"
configurations=[]
`,
        // eslint-disable-next-line unicorn/prefer-string-raw -- Bun escapes Unicode in raw templates and changes this expected TOML value.
        expected: `# Native options
[tools.eslint.rules]
options = [
    # Native inline
    { a = 1, b = ["x", "y"], note = "First line\\n# String data\\nLast line" },
]

# Unicode scope
[[scope]]
path = "apps/前言"
`,
    },
    {
        name: `inline field`,
        source: `[tools.eslint.rules]
 # Field comment
 values=[1,2]
`,
        expected: `[tools.eslint.rules]
# Field comment
values = [1, 2]
`,
    },
] as const;
