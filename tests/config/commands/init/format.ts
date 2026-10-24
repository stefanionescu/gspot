export const INVALID_PRETTIER_OPTIONS = [
    { file: '.prettierrc.json', text: '{"tabWidth":"4"}', field: 'tabWidth' },
    { file: 'package.json', text: '{"prettier":{"printWidth":"wide"}}', field: 'printWidth' },
    { file: 'app/.prettierrc.json', text: '{"tabWidth":"4"}', field: 'tabWidth' },
    { file: 'app/package.json', text: '{"prettier":{"printWidth":"wide"}}', field: 'printWidth' },
];

export const FORMAT_FILE_CASES = [
    {
        name: 'no formatter configuration',
        files: {},
        expected: { indent_width: 4, print_width: 120 },
    },
    {
        name: 'Prettier dependency without configuration',
        files: { 'package.json': '{"devDependencies":{"prettier":"3.8.1"}}' },
        expected: { indent_width: 2, print_width: 80, quotes: 'double' },
    },
    {
        name: 'partial Prettier JSON configuration',
        files: { '.prettierrc.json': '{"tabWidth":3}' },
        expected: { indent_width: 3, print_width: 80, quotes: 'double' },
    },
    {
        name: 'Prettier .prettierrc configuration',
        files: { '.prettierrc': 'printWidth: 100\ntabWidth: 4\n' },
        expected: { indent_width: 4, print_width: 100 },
    },
    {
        name: 'Prettier .prettierrc.yaml configuration',
        files: { '.prettierrc.yaml': 'printWidth: 100\ntabWidth: 4\n' },
        expected: { indent_width: 4, print_width: 100 },
    },
    {
        name: 'Prettier .prettierrc.yml configuration',
        files: { '.prettierrc.yml': 'printWidth: 100\ntabWidth: 4\n' },
        expected: { indent_width: 4, print_width: 100 },
    },
    {
        name: 'Prettier .prettierrc.json5 configuration',
        files: { '.prettierrc.json5': '{ printWidth: 100, tabWidth: 4, }\n' },
        expected: { indent_width: 4, print_width: 100 },
    },
    {
        name: 'Prettier .prettierrc.toml configuration',
        files: { '.prettierrc.toml': 'printWidth = 100\ntabWidth = 4\n' },
        expected: { indent_width: 4, print_width: 100 },
    },
    {
        name: 'Prettier package configuration',
        files: { 'package.json': '{"prettier":{"tabWidth":6,"printWidth":100,"singleQuote":true}}' },
        expected: { indent_width: 6, print_width: 100, quotes: 'single' },
    },
    {
        name: 'Prettier JavaScript configuration',
        files: { 'prettier.config.mjs': 'export default { tabWidth: 3, printWidth: 90, singleQuote: false };' },
        expected: { indent_width: 4, print_width: 120 },
    },
    {
        name: 'EditorConfig without indent_style',
        files: {
            '.editorconfig': `root = true
[*]
indent_size = 3
max_line_length = 96
`,
        },
        expected: { indent_width: 3, print_width: 96 },
    },
    {
        name: 'EditorConfig project settings and section overrides',
        files: { '.editorconfig': '[*]\nindent_size = 4\n[*.json]\nindent_size = 2\n' },
        expected: { indent_width: 4, override: [{ paths: ['**/*.json'], indent_width: 2 }] },
    },
    {
        name: 'Prettier precedence over EditorConfig',
        files: {
            '.prettierrc.json': '{"singleQuote":true}',
            '.editorconfig': `root = true
[*]
indent_size = 6
max_line_length = 96
`,
        },
        expected: { indent_width: 2, print_width: 80, quotes: 'single' },
    },
    {
        name: 'declared Prettier defaults before EditorConfig',
        files: {
            'package.json': '{"devDependencies":{"prettier":"3.8.1"}}',
            '.editorconfig': `root = true
[*]
indent_size = 6
max_line_length = 96
`,
        },
        expected: { indent_width: 2, print_width: 80, quotes: 'double' },
    },
] as const;

export const SCOPE_FORMAT_FILES = {
    '.prettierrc.json': '{"tabWidth":2,"printWidth":90,"singleQuote":false}',
    'app/.prettierrc.json': '{"tabWidth":6,"printWidth":100,"singleQuote":true}',
    'app/source.js': 'export const app = 1;\n',
    'app/deep/source.js': 'export const deep = 1;\n',
    'sibling/source.js': 'export const sibling = 1;\n',
} as const;

export const PRETTIER_FORMAT_OPTIONS = {
    quotes: 'double',
    override: [
        { paths: ['**/*.ts', 'src/**/*.css'], indent_width: 2, print_width: 100 },
        { paths: ['**/*.py'], quotes: 'single' },
    ],
} as const;

export const FORMAT_WORKSPACE_FILES = {
    'package.json': '{"private":true,"workspaces":["app","app/deep","sibling"]}',
    'app/package.json': '{"private":true}',
    'app/deep/package.json': '{"private":true}',
    'sibling/package.json': '{"private":true}',
} as const;
