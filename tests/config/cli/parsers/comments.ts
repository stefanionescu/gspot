/** Native comment boundaries with distinct source forms. */
export const COMMENT_BOUNDARIES = [
    [
        'TOML multiline basic string',
        'source.toml',
        'value = """\n# marker: Literal sample text.\n"""\n# marker: Required interface.\nactual = 1\n',
        4,
    ],
    [
        'TOML multiline literal string',
        'source.toml',
        "value = '''\n# marker: Literal sample text.\n'''\n# marker: Required interface.\nactual = 1\n",
        4,
    ],
    [
        'SQL dollar-quoted value',
        'source.sql',
        'select $body$\n-- marker: Literal sample text.\n$body$;\n-- marker: Required interface.\nselect 1;\n',
        4,
    ],
    [
        'SQL multiline quoted value',
        'source.sql',
        "select '\n-- marker: Literal sample text.\n';\n-- marker: Required interface.\nselect 1;\n",
        4,
    ],
    [
        'Postgres block comment',
        'source.pgsql',
        '/* Example directive:\n-- marker: Literal sample text.\n*/\n-- marker: Required interface.\nselect 1;\n',
        4,
    ],
    [
        'psql echo argument',
        'source.psql',
        '\\echo -- marker: Literal sample text.\n-- marker: Required interface.\nselect 1;\n',
        2,
    ],
    [
        'Markdown fenced HTML',
        'source.md',
        '```html\n<!-- marker: Literal sample text. -->\n```\n<!-- marker: Required interface. -->\nText.\n',
        4,
    ],
    [
        'Markdown inline HTML',
        'source.md',
        '`<!-- marker: Literal sample text. -->`\n<!-- marker: Required interface. -->\nText.\n',
        2,
    ],
    ['Markdown line after an emoji', 'source.md', 'Example 😀\n\n<!-- marker: Required interface. -->\nText.\n', 3],
    [
        'YAML literal block',
        'source.yaml',
        'value: |\n  # marker: Literal sample text.\n# marker: Required interface.\nactual: 1\n',
        3,
    ],
    [
        'YAML multiline quoted value',
        'source.yaml',
        'value: "\n  # marker: Literal sample text.\n  "\n# marker: Required interface.\nactual: 1\n',
        4,
    ],
    [
        'Python multiline string',
        'source.py',
        'value = """\n# marker: Literal sample text.\n"""\n# marker: Required interface.\nvalue = 1\n',
        4,
    ],
    [
        'Bash heredoc',
        'source.sh',
        'cat <<EOF\n# marker: Literal sample text.\nEOF\n# marker: Required interface.\nvalue=1\n',
        4,
    ],
    [
        'Swift multiline string',
        'source.swift',
        'let value = """\n// marker: Literal sample text.\n"""\n// marker: Required interface.\nlet actual = 1\n',
        4,
    ],
    [
        'HTML script content',
        'source.html',
        '<script>\nconst value = "<!-- marker: Literal sample text. -->";\n</script>\n<!-- marker: Required interface. -->\n<div></div>\n',
        4,
    ],
] as const;
