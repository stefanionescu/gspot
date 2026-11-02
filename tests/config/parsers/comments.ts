export const DOCSTRING_CASES = [
    ['', 'todo'],
    ['r', 'todo'],
    ['f', undefined],
    ['rb', undefined],
] as const;

export const QUOTED_PSQL_SOURCES = [
    "SELECT ':value', E'\\\\:value', $$:value$$, $body$\n\\set literal\n$body$;",
    '/* :value /* :nested */ :value */',
    '-- :value',
    'SELECT 1::int;',
] as const;

export const NESTED_COMMENT_SQL = [
    '-- 前言',
    '/* outer',
    ' /* nested */',
    '*/',
    'DROP TABLE app.users;',
    '-- Between statements.',
    '/* next */',
    ' SELECT 1;',
].join('\n');

export const FROZEN_MIGRATION_PATHS = ['db/V20240101__init.sql', 'db/V20240202__users.sql'] as const;

export const FROZEN_MIGRATION_CASES = [
    { through: '20240101', frozen: [FROZEN_MIGRATION_PATHS[0]] },
    { through: 'V20240101', frozen: [FROZEN_MIGRATION_PATHS[0]] },
    { through: 'none', frozen: [] },
    { through: 'all', frozen: FROZEN_MIGRATION_PATHS },
] as const;

export const SELECT_SQL = 'SELECT 2';

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

export const COMPONENT_SCRIPT_COMMENTS = [
    {
        path: 'Component.vue',
        source: '<script lang="tsx">const view = <p>// marker: JSX text.</p>;\n// marker: Script directive.\n</script>',
        lines: [2],
    },
    {
        path: 'App.vue',
        source: '<template><p>// marker: Template text.</p></template>\n<script lang="ts">\n// marker: Script directive.\nconst sample = "// marker: String text.";\n</script>\n<!-- marker: Markup directive. -->\n',
        lines: [3, 6],
    },
    {
        path: 'Component.svelte',
        source: '<script context="module">\n// marker: Module directive.\n</script>\n<script>\n// marker: Instance directive.\n</script>\n<p>// marker: Template text.</p>\n<!-- marker: Markup directive. -->\n',
        lines: [2, 5, 8],
    },
    {
        path: 'Page.astro',
        source: '---\n// marker: Front matter directive.\nconst sample = "<!-- marker: String text. -->";\n---\n<p>// marker: Template text.</p>\n<script>\n// marker: Script directive.\n</script>\n<!-- marker: Markup directive. -->\n',
        lines: [2, 7, 9],
    },
] as const;
