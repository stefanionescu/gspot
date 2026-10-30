import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { BASE_INSTALLED_FILES } from '#tests/config/integration/checks/samples.ts';

export const COMMIT_MESSAGES = [
    { message: 'fix(Core): repair the parser', rule: undefined },
    { message: 'fix: repair the parser', rule: undefined },
    { message: 'style(Core): format source', rule: undefined },
    { message: 'revert(Core): restore source', rule: undefined },
    { message: 'feat(Core)!: drop the parser option', rule: undefined },
    { message: 'feat!: drop the parser option', rule: undefined },
    { message: 'fix(root): repair the parser', rule: 'scope-enum' },
    { message: 'fix(hooks): repair the parser', rule: 'scope-enum' },
    { message: 'fix(deps): repair the parser', rule: 'scope-enum' },
    { message: 'fix(core): repair the parser', rule: 'scope-enum' },
    { message: 'fix(Core): repair the parser.', rule: 'subject-full-stop' },
    { message: 'fix(Core): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', rule: undefined },
    { message: 'fix(Core): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', rule: 'header-max-length' },
] as const;

export const COMMITLINT_LEVEL_RESULTS = {
    basic: {
        code: 2,
        output: {
            error: 'arguments',
            message: 'commits/commitlint is off at level basic. Run gspot set level all to turn it on.',
        },
    },
    all: { code: 0, output: { checks: [{ check: 'commits/commitlint', status: 'passed', findings: [] }] } },
} as const;

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
        file: 'final-newline.txt',
        broken: 'content',
        corrected: 'content\n',
        lines: [undefined],
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

export const LICENSES_ROOT_PACKAGE = `{
    "name": "example",
    "version": "1.0.0",
    "private": true,
    "dependencies": { "kind": "1.0.0", "choice": "1.0.0", "combined": "1.0.0", "strict": "1.0.0" }
}
`;

export const LICENSED_PACKAGES = {
    'node_modules/strict/package.json': JSON.stringify({ name: 'strict', version: '1.0.0', license: 'MIT' }),
    'node_modules/kind/package.json': JSON.stringify({ name: 'kind', version: '1.0.0', license: 'MIT' }),
    'node_modules/choice/package.json': JSON.stringify({
        name: 'choice',
        version: '1.0.0',
        license: 'MIT OR (GPL-3.0-only AND GPL-2.0-only)',
    }),
    'node_modules/combined/package.json': JSON.stringify({
        name: 'combined',
        version: '1.0.0',
        license: 'MIT AND (Apache-2.0 OR GPL-3.0-only)',
    }),
} as const;

export const PIP_LICENSES_PYPROJECT = `[project]
name = "sample"
version = "0.0.0"
[tool.pip-licenses]
ignore-packages = ["licensed-example"]
`;

export const MIT_ONLY = { allowed: ['MIT'] } as const;

export const API_TOKEN = 'n3K5p7R9' + 't2V4w6Y8' + 'z1A3c5E7' + 'g9I2m4O6';

export const AWS_KEY_ID = 'AKIA' + 'IOSFODNN7' + 'EXAMPLA';

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
    { patterns: ['**/src/**'], expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/trc/bad.txt'] },
    { patterns: ['*.txt', '!**/keep.txt'], expected: ['nested/src/keep.txt'] },
    {
        patterns: ['{nested/src,other/lib}/**'],
        expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/child/src/bad.txt', 'nested/trc/bad.txt'],
    },
    {
        patterns: ['nested/[st]rc/**'],
        expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/child/src/bad.txt'],
    },
    {
        patterns: ['nested/src/'],
        expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/child/src/bad.txt', 'nested/trc/bad.txt'],
    },
    { patterns: ['nested'], expected: [] },
    { patterns: ['**/nested/**/src/*'], expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/trc/bad.txt'] },
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
