/** Where comments start and end in different source forms. */
export const COMMENT_BOUNDARIES = [
    [
        'Bats quoted hash',
        'test/run.bats',
        'echo "# marker: Literal sample text." # marker: Required interface.\n',
        1,
        ['shell', 'bash', 'bats', 'text'],
    ],
    ['Python type stub', 'stub.pyi', 'x: int  # marker: Required interface.\n', 1, ['python', 'pyi', 'text']],
    [
        'extensionless Bash script',
        '.mise/tasks/test',
        '#!/usr/bin/env bash\necho "# marker: Literal sample text." # marker: Required interface.\n',
        2,
        ['shell', 'executable', 'text'],
    ],
    [
        'extensionless Python script',
        'scripts/check',
        '#!/usr/bin/env python3\nx = "# marker: Literal sample text."  # marker: Required interface.\n',
        2,
        ['python', 'executable', 'text'],
    ],
    [
        'TypeScript declaration',
        'source.d.ts',
        'declare const text: "// marker: Literal sample text."; // marker: Required interface.\n',
        1,
        ['typescript', 'text'],
    ],
    [
        'TOML multiline basic string',
        'source.toml',
        `value = """
# marker: Literal sample text.
"""
# marker: Required interface.
actual = 1
`,
        4,
        [],
    ],
    [
        'TOML multiline literal string',
        'source.toml',
        `value = '''
# marker: Literal sample text.
'''
# marker: Required interface.
actual = 1
`,
        4,
        [],
    ],
    [
        'SQL dollar-quoted value',
        'source.sql',
        `select $body$
-- marker: Literal sample text.
$body$;
-- marker: Required interface.
select 1;
`,
        4,
        [],
    ],
    [
        'SQL multiline quoted value',
        'source.sql',
        `select '
-- marker: Literal sample text.
';
-- marker: Required interface.
select 1;
`,
        4,
        [],
    ],
    [
        'Postgres block comment',
        'source.pgsql',
        `/* Example directive:
-- marker: Literal sample text.
*/
-- marker: Required interface.
select 1;
`,
        4,
        [],
    ],
    [
        'psql echo argument',
        'source.psql',
        String.raw`\echo -- marker: Literal sample text.
-- marker: Required interface.
select 1;
`,
        2,
        [],
    ],
    [
        'Markdown fenced HTML',
        'source.md',
        `\`\`\`html
<!-- marker: Literal sample text. -->
\`\`\`
<!-- marker: Required interface. -->
Text.
`,
        4,
        [],
    ],
    [
        'Markdown inline HTML',
        'source.md',
        `\`<!-- marker: Literal sample text. -->\`
<!-- marker: Required interface. -->
Text.
`,
        2,
        [],
    ],
    [
        'Markdown line after an emoji',
        'source.md',
        `Example 😀

<!-- marker: Required interface. -->
Text.
`,
        3,
        [],
    ],
    [
        'YAML literal block',
        'source.yaml',
        `value: |
  # marker: Literal sample text.
# marker: Required interface.
actual: 1
`,
        3,
        [],
    ],
    [
        'YAML multiline quoted value',
        'source.yaml',
        `value: "
  # marker: Literal sample text.
  "
# marker: Required interface.
actual: 1
`,
        4,
        [],
    ],
    [
        'Python multiline string',
        'source.py',
        `value = """
# marker: Literal sample text.
"""
# marker: Required interface.
value = 1
`,
        4,
        [],
    ],
    [
        'Bash heredoc',
        'source.sh',
        `cat <<EOF
# marker: Literal sample text.
EOF
# marker: Required interface.
value=1
`,
        4,
        [],
    ],
    [
        'Swift multiline string',
        'source.swift',
        `let value = """
// marker: Literal sample text.
"""
// marker: Required interface.
let actual = 1
`,
        4,
        [],
    ],
    [
        'HTML script content',
        'source.html',
        `<script>
const value = "<!-- marker: Literal sample text. -->";
</script>
<!-- marker: Required interface. -->
<div></div>
`,
        4,
        [],
    ],
] as const;

export const MARKER_COMMENT = /^(?:\/\/|#|--|<!--) ?marker:/u;
