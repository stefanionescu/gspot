export const ARRAY_COMMENT_CASES = [
    {
        name: `delete array items and free prose`,
        source: `# Global note

# Exclusions
test_files=[
 # Keep A
 "a/**", # A inline
 # Delete B
 "b/**", # B inline
 # Keep C
 "c/**"
] # Array inline

# Free prose

[hooks]
enabled=true
`,
        target: `test_files = [ "a/**", "c/**" ]

[hooks]
enabled = true
`,
        expected: `# Global note

# Exclusions
# Array inline
test_files = [
    # Keep A
    # A inline
    "a/**",
    # Keep C
    "c/**",
]

# Free prose

[hooks]
enabled = true
`,
    },
    {
        name: `nested arrays`,
        source: `[tools.eslint]
extra.reason = "The project keeps reviewed native options."
extra.value={ values=[
 # First group
 [
 # First number
 1, # First inline
 2
 ], # First group inline
 # Second group
 [
 # Last number
 3
 ]
] }
`,
        expected: `[tools.eslint.extra]
reason = "The project keeps reviewed native options."

[tools.eslint.extra.value]
values = [
    # First group
    # First group inline
    [
        # First number
        # First inline
        1,
        2,
    ],
    # Second group
    [
        # Last number
        3,
    ],
]
`,
    },
    {
        name: `mixed array`,
        source: `[tools.eslint]
extra.reason = "The project keeps reviewed native options."
extra.value={ values=[
 # A table
 {a=[
 # Nested table number
 1
 ]},
 # A scalar
 2
] }
`,
        expected: `[tools.eslint.extra]
reason = "The project keeps reviewed native options."

[tools.eslint.extra.value]
values = [
    # A table
    { a = [
        # Nested table number
        1,
    ] },
    # A scalar
    2,
]
`,
    },
] as const;
