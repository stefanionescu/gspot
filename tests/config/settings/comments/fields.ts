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
# Copied from template team, sha256 abc.
# Root
level="all" # Level inline
# Dotted hook
hooks.enabled=true

# Z scope
[[scope]]
path="z/app"
level="all"

# A check
[[command_check]]
name="a/task"
command=["bun","task.ts"]
paths=["src/**"]
summary="Old task" # Summary inline

# A scope
[[scope]]
path="a/app"
level="recommended"
`,
        target: `level="all"
hooks.enabled=true
[[scope]]
path="z/app"
level="all"
[[scope]]
path="a/app"
level="recommended"
[[command_check]]
name="a/task"
command=["bun","task.ts"]
paths=["src/**"]
summary="Changed task"
`,
        expected: `# Copied from template team, sha256 abc.

# schema note
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
level = "recommended"

# A check
[[command_check]]
name = "a/task"
command = ["bun", "task.ts"]
paths = ["src/**"]
# Summary inline
summary = "Changed task"
`,
    },
    {
        name: `inline tool options and Unicode tables`,
        source: `# Native options
[tools.eslint]
extra={value={a=1,b=["x","y"],note="""First line
# String data
Last line"""},reason="Reviewed native options keep these values."} # Native inline

# Unicode scope
[[scope]]
path="apps/前言"
configurations=[]
`,
        // eslint-disable-next-line unicorn/prefer-string-raw -- Bun escapes Unicode in raw templates and changes this TOML value.
        target: `[tools.eslint]
extra={value={a=1,b=["x","y"],note="First line\\n# String data\\nLast line"},reason="Reviewed native options keep these values."}
[[scope]]
path="apps/前言"
configurations=[]
`,
        // eslint-disable-next-line unicorn/prefer-string-raw -- Bun escapes Unicode in raw templates and changes this expected TOML value.
        expected: `# Native options
[tools.eslint]

# Native inline
[tools.eslint.extra]
reason = "Reviewed native options keep these values."

[tools.eslint.extra.value]
a = 1
b = ["x", "y"]
note = "First line\\n# String data\\nLast line"

# Unicode scope
[[scope]]
path = "apps/前言"
`,
    },
    {
        name: `inline field`,
        source: `[tools.eslint]
extra.reason = "The project keeps reviewed native options."
extra.value={
 # Field comment
 values=[1,2]
 }
`,
        expected: `[tools.eslint.extra]
reason = "The project keeps reviewed native options."

[tools.eslint.extra.value]
# Field comment
values = [1, 2]
`,
    },
] as const;
