export const INVALID_PRETTIER_OPTIONS = [
    { file: '.prettierrc.json', text: '{"tabWidth":"4"}', field: 'tabWidth' },
    { file: 'app/package.json', text: '{"prettier":{"printWidth":"wide"}}', field: 'printWidth' },
];

export const CARRYOVER_ROW_CASES = [
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
        row: { covered: 1, dropped: ['MD013'] },
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
        name: 'a Ruff rule that a carried selector holds',
        files: { 'ruff.toml': 'select = ["E", "F", "T20"]\nignore = ["E501"]\n', 'main.py': 'VALUE = 1\n' },
        path: 'ruff.toml',
        row: { carried: ['E', 'ignore E501'], reasons: [] },
    },
    {
        name: 'Ruff rules that the selector ALL holds',
        files: { 'ruff.toml': '[lint]\nselect = ["ALL"]\nignore = ["E", "D"]\n', 'main.py': 'VALUE = 1\n' },
        path: 'ruff.toml',
        row: { carried: ['ALL', 'ignore E', 'ignore D'], reasons: [] },
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
        name: 'a package of a workspace with a value that does not fit',
        files: {
            'package.json': '{"private":true}',
            'packages/web/package.json': '{"dependencies":{"react":19}}',
            'packages/web/source.js': 'export const value = 1;\n',
        },
        path: 'packages/web/package.json',
        row: { tool: 'gspot', dropped: ['the whole file, which gspot could not read'] },
    },
    {
        name: 'a CI file that does not parse',
        files: { '.gitlab-ci.yml': 'quality: [unterminated', 'source.js': 'export const value = 1;\n' },
        path: '.gitlab-ci.yml',
        row: { tool: 'gspot', dropped: ['the whole file, which gspot could not read'] },
    },
    {
        name: 'a package.json key under a Prettier file',
        files: {
            '.prettierrc.json': '{"tabWidth":4}',
            'package.json': '{"private":true,"prettier":{"printWidth":100}}',
            'source.js': 'export const value = 1;\n',
        },
        path: 'package.json',
        row: { carried: [], dropped: ['printWidth'] },
    },
    {
        name: 'a second Prettier file',
        files: {
            '.prettierrc.json': '{"tabWidth":3}',
            '.prettierrc.yaml': 'printWidth: 110\n',
            'source.js': 'export const value = 1;\n',
        },
        path: '.prettierrc.yaml',
        row: { carried: [], dropped: ['printWidth'] },
    },
    {
        name: 'an EditorConfig width under a Prettier file',
        files: {
            '.prettierrc.json': '{"tabWidth":2}',
            '.editorconfig': '[*]\nindent_size = 8\nmax_line_length = 100\n',
            'source.js': 'export const value = 1;\n',
        },
        path: '.editorconfig',
        row: { carried: ['max_line_length'], dropped: ['indent_size'] },
    },
    {
        name: 'an EditorConfig width that gspot.toml cannot hold',
        files: { '.editorconfig': '[*]\nmax_line_length = 9999\n', 'source.js': 'export const value = 1;\n' },
        path: '.editorconfig',
        row: { dropped: ['max_line_length'] },
    },
    {
        name: 'an EditorConfig indent and section',
        files: {
            '.editorconfig': '[*]\nindent_style = tab\n[*.md]\nindent_size = 4\n',
            'README.md': '# Example\n',
            'source.js': 'export const value = 1;\n',
        },
        path: '.editorconfig',
        row: { carried: ['indent_style', 'sections'], dropped: [] },
    },
    {
        name: 'a Prettier script that does not load',
        files: {
            'prettier.config.mjs': "import missing from './missing.mjs';\nexport default missing;\n",
            'source.js': 'export const value = 1;\n',
        },
        path: 'prettier.config.mjs',
        row: { dropped: ['the whole file, which gspot could not read'] },
    },
] as const;

export const UNREADABLE_PRETTIER_FILES = [
    { path: 'prettier.config.mjs', text: "import missing from './missing.mjs';\nexport default missing;\n" },
    { path: '.prettierrc.json5', text: '// formatting\n{ tabWidth: 4, }\n' },
] as const;
