export const INVALID_PRETTIER_OPTIONS = [
    { file: '.prettierrc.json', text: '{"tabWidth":"4"}', field: 'tabWidth' },
    { file: 'app/package.json', text: '{"prettier":{"printWidth":"wide"}}', field: 'printWidth' },
];

export const FORMAT_FILE_CASES = [
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
        name: 'Prettier .prettierrc.json5 configuration',
        files: { '.prettierrc.json5': '{ printWidth: 100, tabWidth: 4, }\n' },
        expected: { indent_width: 4, print_width: 100 },
    },
    {
        name: 'Prettier ignore file beside EditorConfig',
        files: { '.prettierignore': 'dist/\n', '.editorconfig': '[*]\nindent_size = 4\nmax_line_length = 100\n' },
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
        expected: { indent_width: 6, print_width: 96, quotes: 'single' },
    },
    {
        name: 'EditorConfig before declared Prettier defaults',
        files: {
            'package.json': '{"devDependencies":{"prettier":"3.8.1"}}',
            '.editorconfig': `root = true
[*]
indent_size = 6
max_line_length = 96
`,
        },
        expected: { indent_width: 6, print_width: 96, quotes: 'double' },
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
        { paths: ['**/*.py'], print_width: 88, quotes: 'single' },
    ],
} as const;

export const WORKSPACE_PYTHON_FILES = {
    'package.json': '{"private":true,"workspaces":["service"]}',
    'source.ts': 'export {};\n',
    'service/package.json': '{"private":true}',
    'service/main.py': 'value = 1\n',
} as const;

export const FORMAT_WORKSPACE_FILES = {
    'package.json': '{"private":true,"workspaces":["app","app/deep","sibling"]}',
    'app/package.json': '{"private":true}',
    'app/deep/package.json': '{"private":true}',
    'sibling/package.json': '{"private":true}',
} as const;

export const UNREADABLE_PRETTIER_FILES = [
    { path: 'prettier.config.mjs', text: 'export default { printWidth: 100 };\n' },
    { path: '.prettierrc.json5', text: '// formatting\n{ tabWidth: 4, }\n' },
] as const;

export const DEFAULT_CASES = [
    {
        name: `defaults are omitted`,
        source: `level="basic"
tool_timeout_seconds=600
[hooks]
enabled=true
[format]
indent_style="space"
indent_width=4
`,
        expected: ``,
    },
    {
        name: `scope restores default after parent override`,
        source: `[format]
indent_width=2
[[scope]]
path="app"
format.indent_width=4
[[scope]]
path="app/worker"
format.indent_width=4
[[scope]]
path="notes"
format.indent_width=2
`,
        expected: `[format]
indent_width = 2

[[scope]]
path = "app"
format = { indent_width = 4 }

[[scope]]
path = "app/worker"

[[scope]]
path = "notes"
`,
    },
    {
        name: `language default restores root limit`,
        source: `[limits]
max_file_lines={value=500,reason="Reviewed root files need this ceiling."}
[[scope]]
path="app"
limits.python.max_file_lines=300
[[scope]]
path="app/worker"
limits.python.max_file_lines=300
`,
        expected: `[limits]
max_file_lines = { value = 500, reason = "Reviewed root files need this ceiling." }

[[scope]]
path = "app"
limits = { python = { max_file_lines = 300 } }

[[scope]]
path = "app/worker"
`,
    },
] as const;

export const IMPORT_STYLE_CASES = [
    {
        name: 'a tsconfig that imports .ts files by name',
        files: {
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"allowImportingTsExtensions":true,"noEmit":true}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: 'ts',
    },
    {
        name: 'an esbuild bundle',
        files: {
            'package.json': '{"private":true,"type":"module","devDependencies":{"esbuild":"0.25.0"}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: 'extensionless',
    },
    {
        name: 'a Node.js package',
        files: {
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: undefined,
    },
] as const;

export const WORKSPACE_SITE_FILES = {
    'package.json': '{"name":"root","private":true,"workspaces":["apps/*"]}',
    'source.ts': 'export const root = true;\n',
    'apps/site/package.json': '{"name":"site","private":true}',
    'apps/site/source.py': 'VALUE = 1\n',
} as const;

export const TEAM_TEMPLATE = `# gspot settings for this repository. Change them with gspot set, unset, add, remove, ignore, and unignore.

configurations = ["typescript"]
level = "all"
test_files = ["**/*.spec.ts"]

# The parsers are state machines.
[limits]
max_function_lines = { value = 80, reason = "The parsers are state machines." }

[javascript]
import_extension = "js"

[tools.eslint.rules]
eqeqeq = ["smart"]

[[scope]]
path = "apps/web"
configurations = ["react"]

[[command_check]]
id = "licenses"
command = ["./scripts/licenses.sh"]
paths = ["**/*"]
stage = "manual"

[[ignore]]
check = "commits/commitlint"
rule = "subject-case"
reason = "Our commit subjects start with a ticket number."

[[ignore]]
check = "javascript/eslint"
rule = "no-console"
paths = ["scripts/**"]
reason = "The scripts print their output."

[ci]
enabled = true
provider = "github"

[nginx]
image = "nginx:stable"

[[import_rule]]
name = "app"
paths = ["app/**"]

[[ignore]]
check = "licenses"
reason = "The command runs separately."
`;

export const TEAM_LEFT_OUT = [
    { key: 'ci.enabled', note: 'CI stays off; run gspot set ci.enabled true' },
    { key: 'ci.provider', note: 'CI stays off; run gspot set ci.enabled true' },
    { key: 'nginx.image', note: 'runs code' },
    { key: '[[import_rule]] app', note: 'names paths of that repository' },
    { key: '[[ignore]] licenses', note: 'ignores a command check' },
    { key: 'test_files', note: 'names paths of that repository' },
    { key: 'javascript.import_extension', note: 'describes that repository' },
    { key: '[[scope]] apps/web', note: 'names paths of that repository' },
    { key: '[[command_check]] licenses', note: 'runs code' },
    { key: '[[ignore]] javascript/eslint no-console', note: 'names paths of that repository' },
];

export const TEMPLATE_REFUSALS = [
    { name: 'a missing file', files: {}, from: 'missing.toml', message: 'There is no file at missing.toml.' },
    {
        name: 'invalid UTF-8',
        files: { 'invalid.toml': Buffer.from([0xff]) },
        from: 'invalid.toml',
        message: 'invalid.toml must contain valid UTF-8 text.',
    },
    {
        name: 'a folder',
        files: { 'folder/a.txt': '' },
        from: 'folder',
        message: '--from needs a file, and folder is a folder.',
    },
    {
        name: 'invalid TOML',
        files: { 'broken.toml': 'configurations = ["typescript"\n' },
        from: 'broken.toml',
        message: 'broken.toml:1:18 is not valid TOML: Expected "]". Fix the file.',
    },
];

export const TEMPLATE_SCOPE_FILES = {
    'package.json': '{"private":true,"workspaces":["apps/*"]}',
    'apps/web/package.json': '{"private":true,"dependencies":{"react":"1.0.0"}}',
    'apps/web/app.tsx': 'export const App = () => <main>Hello</main>;\n',
};

export const COMMENTED_TEMPLATE = `# Old team preface
configurations = ['typescript']

# Keep modules short.
[limits]
max_file_lines = 100
`;

export const SIMULATOR_DESTINATION = 'generic/platform=iOS Simulator';
