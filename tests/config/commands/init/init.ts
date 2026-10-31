export const DEFAULT_CASES = [
    {
        name: `defaults are omitted`,
        source: `level="basic"
tool_timeout_seconds=600
[hooks]
enabled=false
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
file_lines={value=500,reason="Reviewed root files need this ceiling."}
[[scope]]
path="app"
limits.python.file_lines=300
[[scope]]
path="app/worker"
limits.python.file_lines=300
`,
        expected: `[limits]
file_lines = { value = 500, reason = "Reviewed root files need this ceiling." }

[[scope]]
path = "app"
limits = { python = { file_lines = 300 } }

[[scope]]
path = "app/worker"
`,
    },
] as const;

export const GIT_PLAN_CASES = [{ name: 'a Git repository', changes: [] }] as const;

export const EDITORCONFIG_WRITE = [
    {
        path: '.editorconfig',
        note: 'replaces your file; read the old one with git show HEAD:.editorconfig',
    },
] as const;

export const QUALITY_PACKAGE_FILES = {
    'package.json': '{"name":"shop","private":true,"type":"module","dependencies":{"react":"19.0.0"}}\n',
    'src/app.tsx': 'export const App = () => null;\n',
    'quality/package.json': '{"name":"shop-quality","private":true,"dependencies":{"ts-morph":"26.0.0"}}\n',
    'quality/check.ts': 'export const value = 1;\n',
    '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
} as const;

export const SHARED_SETUP_FILES = {
    'setup.cfg': `[flake8]
ignore = E501
[sqlfluff]
exclude_rules = LT01
`,
    '.gitlab-ci.yml': 'quality:\n  script: npm run lint\n',
    'query.sql': 'SELECT 1;\n',
} as const;

export const ATTRIBUTES_PLAN_ROW = {
    path: '.gitattributes',
    note: 'marks the generated files and keeps LF line endings',
} as const;

const UNCOMMITTED_FORMAT_FILES = [
    { path: '.prettierrc', original: '{"printWidth": 100}\n', changed: '{"printWidth": 90}\n' },
] as const;

export const UNCOMMITTED_FORMAT_CASES = ['unborn Git', 'untracked', 'staged changes', 'unstaged changes'].flatMap(
    (state) => UNCOMMITTED_FORMAT_FILES.map((file) => ({ ...file, state })),
);

export const TOOL_ONLY_PACKAGE = '{"private":true,"devDependencies":{"prettier":"3.8.1"}}\n';

export const CONFIGURATION_CHOICES = [
    { configurations: undefined, selected: ['javascript'] },
    { configurations: undefined, noConfigurations: true, selected: [] },
    { configurations: ['python'], selected: ['python'] },
] as const;

export const PLATFORM_PROJECT_FILES = {
    'package.json': '{"name":"app","private":true,"type":"module"}\n',
    'supabase/config.toml': 'project_id = "example"\n',
    'ios/Package.swift': `// swift-tools-version:6.0
import PackageDescription
let package = Package(name: "App")
`,
    'ios/Sources/App/App.swift': 'let answer = 42\n',
    'tools/lint/package.json': '{"name":"lint","private":true,"devDependencies":{"eslint":"9.39.5"}}\n',
} as const;

export const STYLE_SOURCE_FILES = {
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'src/styles.css': `p {
    color: #abc;
}
`,
} as const;

export const NEXTJS_LOCALE_CASES = [
    { dependency: false, named: false, isSelected: false },
    { dependency: true, named: false, isSelected: false },
    { dependency: false, named: true, isSelected: true },
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
function_lines = { value = 80, reason = "The parsers are state machines." }

[tools.eslint]
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

[tools.nginx]
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
    { key: 'tools.nginx.image', note: 'runs code' },
    { key: '[[import_rule]] app', note: 'names paths of that repository' },
    { key: '[[ignore]] licenses', note: 'ignores a command check' },
    { key: 'test_files', note: 'names paths of that repository' },
    { key: 'tools.eslint.import_extension', note: 'describes that repository' },
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
file_lines = 100
`;

export const COPIED_TEMPLATE = `# Change these settings with gspot set, unset, add, remove, ignore, or unignore.
configurations = ['typescript']

[hooks]
enabled = true

# Keep modules short.
[limits]
file_lines = 100
`;

export const GENERATED_WRITE_MESSAGE = 'Generated write denied';

export const STOPPED_ERROR_MESSAGE =
    'gspot stopped because of an internal error: Generated write denied. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.\n';
