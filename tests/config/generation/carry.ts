export const INVALID_PRETTIER_OPTIONS = [
    { file: '.prettierrc.json', text: '{"tabWidth":"4"}', field: 'tabWidth' },
    { file: 'app/package.json', text: '{"prettier":{"printWidth":"wide"}}', field: 'printWidth' },
];

export const CARRY_ROW_CASES = [
    {
        name: 'options for a markdownlint rule that gspot turns off',
        files: { '.markdownlint.jsonc': '{ "MD013": { "line_length": 120 } }', 'README.md': '# Example\n' },
        path: '.markdownlint.jsonc',
        row: { dropped: ['MD013'], reasons: [] },
    },
    {
        name: 'a markdownlint rule that gspot turns off too',
        files: { '.markdownlint.jsonc': '{ "MD013": false }', 'README.md': '# Example\n' },
        path: '.markdownlint.jsonc',
        row: { covered: 1, reasons: [] },
    },
    {
        name: 'a markdownlint-cli2 file with no rules',
        files: { '.markdownlint-cli2.jsonc': '{ "globs": ["**/*.md"] }', 'README.md': '# Example\n' },
        path: '.markdownlint-cli2.jsonc',
        row: { dropped: ['globs'] },
    },
    {
        name: 'a markdownlint rule alias',
        files: {
            '.markdownlint.json': '{ "line-length": { "line_length": 120 }, "MD033": false }',
            'README.md': '# Example\n',
        },
        path: '.markdownlint.json',
        row: { covered: 1, dropped: ['line-length'] },
    },
    {
        name: 'a markdownlint value that is no table of options',
        files: { '.markdownlint.json': '{ "MD024": "warning" }', 'README.md': '# Example\n' },
        path: '.markdownlint.json',
        row: { dropped: ['MD024'] },
    },
    {
        name: 'a markdownlint rule turned on without the options of gspot',
        files: { '.markdownlint.json': '{ "MD024": true }', 'README.md': '# Example\n' },
        path: '.markdownlint.json',
        row: { dropped: ['MD024'] },
    },
    {
        name: 'a markdownlint file that does not parse',
        files: { '.markdownlint.json': '{ nope', 'README.md': '# Example\n' },
        path: '.markdownlint.json',
        row: { dropped: ['the whole file, which gspot could not read'] },
    },
    {
        name: 'the Ruff quote style preserve',
        files: { 'ruff.toml': '[format]\nquote-style = "preserve"\n', 'main.py': 'VALUE = 1\n' },
        path: 'ruff.toml',
        row: { dropped: ['format.quote-style'] },
    },
    {
        name: 'a Ruff file that does not parse',
        files: { 'ruff.toml': 'select = [\n', 'main.py': 'VALUE = 1\n' },
        path: 'ruff.toml',
        row: { dropped: ['the whole file, which gspot could not read'] },
    },
    {
        name: 'a pyproject.toml that does not parse',
        files: { 'pyproject.toml': '[project\n', 'main.py': 'VALUE = 1\n' },
        path: 'pyproject.toml',
        row: { dropped: ['the whole file, which gspot could not read'] },
    },
    {
        name: 'the prettier key of package.json',
        files: {
            'package.json': '{"prettier":{"singleQuote":true,"quoteProps":"consistent"}}',
            'source.js': 'export const value = 1;\n',
        },
        path: 'package.json',
        row: { carried: ['singleQuote'], dropped: ['quoteProps'] },
    },
    {
        name: 'a shared Prettier config that package.json names',
        files: { 'package.json': '{"prettier":"@example/style"}', 'source.js': 'export const value = 1;\n' },
        path: 'package.json',
        row: { dropped: ['prettier'] },
    },
    {
        name: 'Prettier widths that gspot.toml cannot hold',
        files: { '.prettierrc.json': '{"tabWidth":0,"printWidth":100000}', 'source.js': 'export const value = 1;\n' },
        path: '.prettierrc.json',
        row: { dropped: ['tabWidth', 'printWidth'] },
    },
    {
        name: 'an EditorConfig width that gspot.toml cannot hold',
        files: { '.editorconfig': '[*]\nmax_line_length = 9999\n', 'source.js': 'export const value = 1;\n' },
        path: '.editorconfig',
        row: { dropped: ['printWidth'] },
    },
] as const;

export const UNREADABLE_PRETTIER_FILES = [
    { path: 'prettier.config.mjs', text: "import missing from './missing.mjs';\nexport default missing;\n" },
    { path: '.prettierrc.json5', text: '// formatting\n{ tabWidth: 4, }\n' },
] as const;
