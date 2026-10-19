export const ALLOWED_PACKAGE_REASON = 'reason = "Reviewed the installed project."\n';

export const ALLOWED_PACKAGE_SCOPE_CASES = [
    {
        name: 'root allowed package that no project installs but the root lockfile holds',
        scopes: ['docs', 'cli'],
        reports: { docs: 'present@1.0.0', cli: 'present@1.0.0' },
        findings: [],
    },
    {
        name: 'root allowed package used only by documentation without a root manifest',
        scopes: ['docs', 'cli'],
        reports: { docs: 'Absent.Package@2.0.0', cli: 'present@1.0.0' },
        findings: [],
    },
    {
        name: 'ignored descendant does not prove a root allowed package stale',
        scopes: ['docs', 'app'],
        reports: { docs: 'present@1.0.0', app: 'Absent.Package@2.0.0' },
        ignore: 'app',
        findings: [],
    },
] as const;

/** Every scanning sandbox declares its license choice. */
export const LICENSE_SETTINGS = '[licenses]\nallowed = ["MIT"]\n';

export const SCANNER_FAILURES = [
    { name: 'empty installed report', stdout: '[]', code: 0, message: 'The license scan found no packages' },
    { name: 'scanner failure', stdout: '[]', code: 1, message: 'sample diagnostic' },
] as const;

export const ALLOWED_PACKAGE_CASES = [
    {
        name: 'exact allowed package',
        license: 'GPL-3.0-only',
        package: 'strict@1.0.0',
        findings: [],
    },
    {
        name: 'another package version',
        license: 'GPL-3.0-only',
        package: 'strict@2.0.0',
        findings: [
            { rule: 'disallowed-license', message: 'strict@1.0.0 uses GPL-3.0-only' },
            { rule: 'unused-record', message: 'strict@2.0.0 matches no locked or installed project dependency' },
        ],
    },
    {
        name: 'normalized Python identity',
        installed: 'Strict_Package',
        license: 'GPL-3.0-only',
        package: 'strict.package@1.0.0',
        findings: [],
    },
] as const;

/** JavaScript package names stay as written; Python package names get normalized in their own reports. */
export const EXPECTED_SCAN_FINDINGS = [
    { file: 'package.json', message: 'unknown@1.0.0 uses UNKNOWN' },
    { file: 'package.json', message: 'python.package@2.0.0 uses GPL-3.0-only' },
    { file: 'pyproject.toml', message: 'prohibited-python@2.0.0 uses GPL-3.0-only' },
] as const;

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

export const LICENSED_EXAMPLE_METADATA = `Metadata-Version: 2.1\nName: licensed-example\nVersion: 1.0.0\nLicense: GPL-3.0-only\n`;

export const FONT_PACKAGE_FILES = {
    'docs/package.json': '{"name":"docs","private":true,"dependencies":{"@fontsource/inter":"5.2.8"}}',
    'docs/node_modules/@fontsource/inter/package.json':
        '{"name":"@fontsource/inter","version":"5.2.8","license":"OFL-1.1"}',
} as const;

export const SAMPLE_PYPROJECT = `[project]
name = "sample"
version = "0.0.0"
`;

export const SCAN_ALLOWED_PACKAGES = `[[licenses.allowed_package]]
name = "choice"
version = "1.0.0"
reason = "Reviewed both installed license alternatives."
[[licenses.allowed_package]]
name = "Python_Package"
version = "2.0.0"
reason = "Reviewed the installed Python package."
`;

export const LICENSE_DEPENDENCY_FILES = [
    ['package.json', '{"name":"example","private":true,"dependencies":{"choice":"1.0.0"}}', 'node_modules'],
    [
        'pyproject.toml',
        `[project]
name = "example"
version = "0.0.0"
`,
        '.venv',
    ],
] as const;

export const NPM_LICENSE_REPORT = {
    'choice@1.0.0': { licenses: ['MIT', 'GPL-3.0-only'] },
    'unknown@1.0.0': {},
    'python.package@2.0.0': { licenses: 'GPL-3.0-only' },
} as const;

export const PYTHON_LICENSE_REPORT = [
    { Name: 'python-package', Version: '2.0.0', 'License-Expression': 'GPL-3.0-only' },
    { Name: 'prohibited-python', Version: '2.0.0', 'License-Expression': 'GPL-3.0-only' },
] as const;

export const ABSENT_PACKAGE_LOCKFILE = `[[package]]
name = "Absent_Package"
version = "2.0.0"
`;

export const LICENSE_TOOL_PROJECT_FILES = {
    '.gspot/probe/pyproject.toml': `[project]
name = "tooling"
version = "0.0.0"
`,
    '.gspot/probe/.venv/installed': 'Absent_Package@2.0.0',
} as const;

export const LICENSE_CHECK = ['check', '--only', 'licenses/allowed', '--json'];
