export const IGNORE_COMMENT_CASES = [
    {
        name: `first ignore`,
        source: `# Root owner
level="all"
`,
        target: `level="all"
[[ignore]]
check="docs/links"
paths=["docs/**"]
reason="Private documentation"
until=2026-12-31
`,
        expected: `# Root owner
level = "all"

[[ignore]]
check = "docs/links"
paths = ["docs/**"]
reason = "Private documentation"
until = 2026-12-31
`,
    },
    {
        name: `merged ignores date array comments`,
        source: `spelling.allowed_words={BannedWord="The project uses this reviewed name."}

# First ignore
[[ignore]] # First header inline
check="z/check"
paths=[
 # A path
 "a.ts", # A inline
]
reason="Reviewed findings stay ignored intentionally."

# Second ignore
[[ignore]] # Second header inline
check="z/check"
paths=[
 # B path
 "b.ts"
]
reason="Reviewed findings stay ignored intentionally."
`,
        target: `spelling.allowed_words={BannedWord="The project uses this reviewed name."}

[[ignore]]
check = "z/check"
paths = [ "a.ts" ]
reason="Reviewed findings stay ignored intentionally."
until = 2026-12-31

[[ignore]]
check = "z/check"
paths = [ "b.ts" ]
reason="Reviewed findings stay ignored intentionally."
until = 2026-12-31
`,
        expected: `[spelling.allowed_words]
BannedWord = "The project uses this reviewed name."

# First ignore
# First header inline
# Second ignore
# Second header inline
[[ignore]]
check = "z/check"
paths = [
    # A path
    # A inline
    "a.ts",
    # B path
    "b.ts",
]
reason = "Reviewed findings stay ignored intentionally."
until = 2026-12-31
`,
    },
    {
        name: `split ignore row`,
        source: `# Original physical row
[[ignore]]
check="a/check"
paths=[
 # Split A
 "a.ts", # Split A inline
 # Split B
 "b.ts" # Split B inline
]
reason="Reviewed findings stay ignored intentionally." # Authored reason
`,
        target: `[[ignore]]
check = "a/check"
paths = [ "a.ts" ]
reason="Reviewed findings stay ignored intentionally."
until = 2026-10-10

[[ignore]]
check = "a/check"
paths = [ "b.ts" ]
reason="Reviewed findings stay ignored intentionally."
until = 2026-12-31
`,
        expected: `# Original physical row
[[ignore]]
check = "a/check"
paths = [
    # Split A
    # Split A inline
    "a.ts",
]
# Authored reason
reason = "Reviewed findings stay ignored intentionally."
until = 2026-10-10

[[ignore]]
check = "a/check"
paths = [
    # Split B
    # Split B inline
    "b.ts",
]
reason = "Reviewed findings stay ignored intentionally."
until = 2026-12-31
`,
    },
    {
        name: `same date rows`,
        source: `# A row
[[ignore]]
check="a/check"
paths=["a.ts"]
reason="Reviewed findings stay ignored intentionally."
until=2026-10-01

# B row
[[ignore]]
check="a/check"
paths=["b.ts"]
reason="Reviewed findings stay ignored intentionally."
until=2026-11-01
`,
        expected: `# A row
[[ignore]]
check = "a/check"
paths = ["a.ts"]
reason = "Reviewed findings stay ignored intentionally."
until = 2026-10-01

# B row
[[ignore]]
check = "a/check"
paths = ["b.ts"]
reason = "Reviewed findings stay ignored intentionally."
until = 2026-11-01
`,
    },
] as const;
