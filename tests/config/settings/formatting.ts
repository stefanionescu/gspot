/** Text shared by settings writers and their retained tests. */
export const SETTINGS_FORMAT_CASES = [
    {
        name: `header comments and omitted defaults`,
        source: `# Copied from template https://example.com/team.toml
level="recommended"
configurations=[]
# Hook comment
[hooks]
enabled=true
`,
        expected: `# Copied from template https://example.com/team.toml

# Hook comment
[hooks]
enabled = true
`,
    },
    {
        name: `calendar expiry and compact paths`,
        source: `configurations=[]
ignore=[{check="gspot/generated-files",reason="Another generator owns reviewed outputs.",paths=["other/**"],until=2027-10-07}]
`,
        expected: `[[ignore]]
check = "gspot/generated-files"
paths = ["other/**"]
reason = "Another generator owns reviewed outputs."
until = 2027-10-07
`,
    },
    {
        name: `non-contiguous extra tables`,
        source: `configurations=[]
# Formatter options
[tools.prettier.extra]
value={singleQuote=false}
reason="The project uses reviewed formatter options."
[hooks]
enabled=true
# Shell sources
[tools.shellcheck.extra]
value={source-path="SCRIPTDIR"}
reason="The project uses reviewed source paths."
`,
        expected: `[hooks]
enabled = true

# Formatter options
[tools.prettier.extra]
reason = "The project uses reviewed formatter options."

[tools.prettier.extra.value]
singleQuote = false

# Shell sources
[tools.shellcheck.extra]
reason = "The project uses reviewed source paths."

[tools.shellcheck.extra.value]
source-path = "SCRIPTDIR"
`,
    },
] as const;

export const UNREPRESENTABLE_SETTINGS = `configurations=[]
[tools.prettier]
extra={ value={ mixed=[{first=1, # This field owns the comment.
second=2},3] }, reason="The sandbox preserves comment ownership." }
`;
