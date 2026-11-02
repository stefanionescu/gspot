import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { AWS_KEY_ID } from '#tests/config/setup/configurations.ts';
import { BASE_INSTALLED_FILES } from '#tests/config/integration/commands.ts';

export const FILES_SANDBOX = {
    configurations: ['data-files'],
    files: {
        'settings/clean.toml': 'a = 1\n',
        'config.yml': '---\nkey: 1\n',
        'schema.json': '{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"]}\n',
    },
} as const;

export const FILES_CASES = [
    {
        check: 'data-files/yaml',
        files: { 'config.yml': 'mode: 0755\n' },
        expected: { file: 'config.yml', line: 1, rule: 'octal-values' },
        corrected: { files: { 'config.yml': 'mode: "0755"\n' } },
    },
    {
        check: 'data-files/taplo-format',
        files: { 'settings/layout.toml': 'a    =     1\nb=2\n' },
        expected: {
            file: 'settings/layout.toml',
        },
        corrected: { files: { 'settings/layout.toml': 'a = 1\nb = 2\n' } },
    },
    {
        check: 'data-files/xmllint',
        files: { 'settings/feed.xml': '<feed>&missing;</feed>\n' },
        expected: { file: 'settings/feed.xml', line: 1 },
        corrected: { files: { 'settings/feed.xml': '<feed>&amp;</feed>\n' } },
    },
] as const;

export const YAML_SCOPE_TABLES = `[format]
indent_width = 4
[[format.override]]
paths = ["**/*.yml"]
indent_width = 2
[[scope]]
path = "app"
configurations = []
`;

export const YAML_SCOPE_FILES = {
    'settings/project.yml': `parent:
  enabled: true
on:
  enabled: true
`,
    'app/settings/project.yml': `parent:
  enabled: false
on:
  enabled: false
`,
} as const;

export const COMMIT_MESSAGES = [
    { message: 'fix(Core): repair the parser', rule: undefined },
    { message: 'fix: repair the parser', rule: undefined },
    { message: 'feat(Core)!: drop the parser option', rule: undefined },
    { message: 'fix(root): repair the parser', rule: 'scope-enum' },
    { message: 'fix(core): repair the parser', rule: 'scope-enum' },
    { message: 'fix(Core): repair the parser.', rule: 'subject-full-stop' },
] as const;

export const UNTYPED_MESSAGE_RULES = ['type-empty', 'subject-empty', 'subject-full-stop'] as const;

export const LINK_PAGE = `<!doctype html>
<html lang="en"><head><title>Setup</title></head><body><h1 id="setup">Setup</h1><p>Current setup.</p></body></html>
`;

export const LINK_SCOPE_TABLES = `[docs]
allowed_urls = { value = ["/root-only$"], reason = "The root guide describes an unavailable endpoint." }
[[scope]]
path = "app"
configurations = []
[scope.docs]
allowed_urls = { value = ["/child-only$"], reason = "The child guide describes an unavailable endpoint." }
`;

export const ROOT_LINK_FILES = {
    'root.md': '# Links\n\nRead [the setup guide](/guides/setup.md#setup).\n',
    'guides/setup.md': '# Setup\n',
    'guides/shop.mdx': '# Shop\n\n<a href={link}>Open the shop</a>\n',
    'web/index.md': '# Shop\n\nRead [the install page](/start/install/).\n',
} as const;

export const DUPLICATED_METADATA = JSON.stringify(
    Array.from({ length: 40 }, (_, value) => ({ name: `entry-${String(value)}`, value })),
    null,
    4,
);

export const SHARED_IMPORTS = Array.from(
    { length: 12 },
    (_, index) => `import { value${String(index)} } from './values/value-${String(index)}.ts';`,
).join('\n');

export const SHARED_PYTHON_IMPORTS = Array.from(
    { length: 12 },
    (_, index) =>
        `import module_${String(index)} as alias_${String(index)}\nfrom package_${String(index)} import (\n    first_${String(index)},\n    second_${String(index)},\n)\nfrom package_${String(index)} import third_${String(index)}, \\\n    fourth_${String(index)}`,
).join('\n');

export const DUPLICATED_PYTHON_LOGIC = Array.from(
    { length: 20 },
    (_, index) => `    total += values[${String(index)}] * ${String(index + 2)}`,
).join('\n');

export const EDITORCONFIG_SAMPLES = [
    {
        file: 'line-endings.txt',
        broken: 'content\r\n',
        corrected: 'content\n',
        lines: [undefined, undefined],
    },
    {
        file: 'trailing-whitespace.txt',
        broken: 'content \n',
        corrected: 'content\n',
        lines: [1],
    },
] as const;

export const STAGED_FORMAT_SOURCE = {
    staged: 'export const value = {\n  value: {\n    active: false,\n  },\n};\n',
    working: 'export const value = {\n    value: {\n        active: false,\n    },\n};\n',
} as const;

export const STAGED_FORMAT_PATHS = {
    source: 'app/value.js',
    scopeConfig: `${GSPOT_PATHS.configurations}/general/format/scopes/app/prettier.json`,
} as const;

export const STAGED_FORMAT_CHECK_ARGUMENTS = [
    'check',
    '--staged',
    '--only',
    'format/prettier',
    '--json',
    '--',
    'app/value.js',
] as const;

export const RUFF_SUPPRESSIONS = [
    { source: 'import os # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # NOQA: F401\n', suppressed: true, directive: true },
    { source: 'import os # NoQa: F401\n', suppressed: true, directive: true },
    { source: 'import os # Example noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # Example # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # noqa-unknown: F401\n', suppressed: false, directive: false },
    { source: 'import os # noqa: F401 # reason: External import.\n', suppressed: true, directive: true },
    { source: '# ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# ruff: NoQa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# flake8: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# Example # ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: 'import os # ruff: noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # flake8: noqa: F401\n', suppressed: false, directive: false },
    { source: '# RUFF: NOQA: F401\nimport os\n', suppressed: false, directive: false },
    { source: '# noqa: F401\nimport os\n', suppressed: false, directive: true },
    { source: 'import os # noqa: F821\n', suppressed: false, directive: true },
] as const;

export const VALE_SUPPRESSIONS = [
    { source: '<!-- vale off -->', suppressed: true, directive: true },
    { source: '<!-- vale Example.Concrete = NO -->', suppressed: true, directive: true },
    { source: '<!-- vale Example.Concrete = YES -->', suppressed: false, directive: true },
    { source: '<!-- vale on -->', suppressed: false, directive: true },
    { source: '<!-- Example vale off -->', suppressed: false, directive: false },
    { source: '`<!-- vale off -->`', suppressed: false, directive: false },
    { source: '```markdown\n<!-- vale off -->\n```', suppressed: false, directive: false },
] as const;

export const VALE_SUPPRESSION_SETTINGS = `StylesPath = styles
[formats]
mdx = md
[*]
BasedOnStyles = Example
`;

export const API_TOKEN = 'n3K5p7R9' + 't2V4w6Y8' + 'z1A3c5E7' + 'g9I2m4O6';

const AWS_CREDENTIALS = `aws_access_key_id = "${AWS_KEY_ID}"\n`;

export const SECRET_FILES = {
    'credential,é.py': `api_key = "${API_TOKEN}"\n`,
    'identity.py': AWS_CREDENTIALS,
} as const;

export const FIXED_SECRET_FILES = {
    'credential,é.py': 'import os\napi_key = os.environ["API_KEY"]\n',
    'identity.py': 'import os\naws_access_key_id = os.environ["AWS_ACCESS_KEY_ID"]\n',
} as const;

export const DOTENV_LINTER_CASES = [
    {
        check: 'secrets/dotenv-linter',
        files: {
            '.env.example': 'PORT=3000\nsecret_key=example\n',
        },
        expected: { file: '.env.example', rule: 'LowercaseKey', line: 2 },
        corrected: { files: { '.env.example': 'PORT=3000\n' } },
    },
] as const;

export const SPELLING_IGNORE_CASES = [
    {
        patterns: ['nested/src/**'],
        expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/child/src/bad.txt', 'nested/trc/bad.txt'],
    },
    { patterns: ['*.txt', '!**/keep.txt'], expected: ['nested/src/keep.txt'] },
    {
        patterns: ['nested/src/'],
        expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/child/src/bad.txt', 'nested/trc/bad.txt'],
    },
] as const;

export const SPELLING_SANDBOX = {
    install: false,
    configurations: ['spelling'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

export const SPELLING_LOCALE_SETTINGS = {
    level: 'all',
    tables: `[spelling]
locale = "en-us"
[[scope]]
path = "british"
[scope.spelling]
locale = "en-gb"
[[scope]]
path = "british/child"
`,
} as const;
