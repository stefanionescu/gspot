export const TEAM_TEMPLATE = `#:schema ./.gspot/gspot.schema.json
# gspot settings for this repository. Change them with gspot set, unset, add, remove, ignore, and unignore.

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
check = "structure/trivial-functions"
names = ["LegacyName"]
reason = "Keep the public API."

[[ignore]]
check = "docs/links"
until = 2099-01-01
reason = "The docs are being moved."

[[ignore]]
check = "licenses"
reason = "The command runs separately."
`;

export const TEAM_LEFT_OUT = [
    { key: 'ci.enabled', note: 'CI stays off; run gspot set ci.enabled true' },
    { key: 'ci.provider', note: 'CI stays off; run gspot set ci.enabled true' },
    { key: 'tools.nginx.image', note: 'runs code' },
    { key: '[[import_rule]] app', note: 'names paths of that repository' },
    { key: '[[ignore]] structure/trivial-functions', note: 'describes that repository' },
    { key: '[[ignore]] docs/links', note: 'ends on a date' },
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
    {
        name: 'an unknown key',
        files: { 'key.toml': '[limits]\nfile_line = 200\n' },
        from: 'key.toml',
        message:
            'key.toml:2: limits.file_line: file_line is not a gspot.toml setting. Did you mean file_lines? See generativespotting.com/reference/gspot-toml/ for every key.',
    },
    {
        name: 'an unknown configuration',
        files: { 'name.toml': 'configurations = ["typescrypt"]\n' },
        from: 'name.toml',
        message:
            'name.toml:1: configurations.0: There is no configuration called typescrypt. Did you mean typescript? See https://generativespotting.com/reference/configurations/ for the available configurations.',
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

export const COPIED_TEMPLATE = `#:schema ./.gspot/gspot.schema.json
# Change these settings with gspot set, unset, add, remove, ignore, or unignore.
configurations = ['typescript']

# Keep modules short.
[limits]
file_lines = 100

[hooks]
enabled = true
`;
