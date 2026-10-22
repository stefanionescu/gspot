export const ALLOWED_PACKAGE_REASON = 'reason = "Reviewed the installed project."\n';

const ABSENT_PACKAGE_LOCKFILE = `[[package]]
name = "Absent_Package"
version = "2.0.0"
`;

export const ALLOWED_PACKAGE_SCOPE_CASES = [
    {
        name: 'root allowed package that no project installs but the root lockfile holds',
        scopes: ['docs', 'cli'],
        reports: { docs: 'present@1.0.0', cli: 'present@1.0.0' },
        lockfiles: { 'uv.lock': ABSENT_PACKAGE_LOCKFILE },
        findings: [],
    },
    {
        name: 'root allowed package used only by documentation without a root manifest',
        scopes: ['docs', 'cli'],
        reports: { docs: 'Absent.Package@2.0.0', cli: 'present@1.0.0' },
        lockfiles: {},
        findings: [],
    },
    {
        name: 'ignored descendant does not prove a root allowed package stale',
        scopes: ['docs', 'app'],
        reports: { docs: 'present@1.0.0', app: 'Absent.Package@2.0.0' },
        lockfiles: {},
        ignore: 'app',
        findings: [],
    },
] as const;

/** Every scanning sandbox declares its license choice. */
export const LICENSE_TABLES = '[licenses]\nallowed = ["MIT"]\n';

export const SCANNER_FAILURES = [
    {
        name: 'empty installed report',
        stdout: '[]',
        code: 0,
        message: () => 'The license scan found no packages. Install the selected project dependencies before scanning.',
    },
    {
        name: 'scanner failure',
        stdout: '[]',
        code: 1,
        message: (python: string) =>
            `pip-licenses --format=json --from=all --python ${python} did not run: sample diagnostic\n[]`,
    },
] as const;

export const ALLOWED_PACKAGE_CASES = [
    {
        name: 'exact allowed package',
        installed: 'strict',
        license: 'GPL-3.0-only',
        package: 'strict@1.0.0',
        findings: [],
    },
    {
        name: 'another package version',
        license: 'GPL-3.0-only',
        installed: 'strict',
        package: 'strict@2.0.0',
        findings: [
            {
                file: 'pyproject.toml',
                rule: 'disallowed-license',
                message: 'strict@1.0.0 uses GPL-3.0-only, which is not allowed.',
            },
            {
                file: 'gspot.toml',
                rule: 'unused-record',
                message:
                    'strict@2.0.0 matches no locked or installed project dependency. Remove the `[[licenses.allowed_package]]` record or correct its name or version.',
            },
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
    { file: 'package.json', message: 'unknown@1.0.0 uses UNKNOWN, which is not allowed.' },
    { file: 'package.json', message: 'python.package@2.0.0 uses GPL-3.0-only, which is not allowed.' },
    { file: 'pyproject.toml', message: 'prohibited-python@2.0.0 uses GPL-3.0-only, which is not allowed.' },
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

/** The root Python project of a license sandbox, with an installed environment. */
export const LICENSE_PROJECT_FILES = { 'pyproject.toml': SAMPLE_PYPROJECT, '.venv/installed': 'sample' };

export const SCAN_ALLOWED_PACKAGES = `[[licenses.allowed_package]]
name = "choice"
version = "1.0.0"
reason = "Reviewed both installed license alternatives."
[[licenses.allowed_package]]
name = "Python_Package"
version = "2.0.0"
reason = "Reviewed the installed Python package."
`;

export const LICENSE_PACKAGE_JSON = '{"name":"example","private":true,"dependencies":{"choice":"1.0.0"}}';

export const LICENSE_DEPENDENCY_FILES = [
    { dependencyFile: 'package.json', text: LICENSE_PACKAGE_JSON, installedFolder: 'node_modules' },
    { dependencyFile: 'pyproject.toml', text: SAMPLE_PYPROJECT, installedFolder: '.venv' },
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

export const LICENSE_TOOL_PROJECT_FILES = {
    '.gspot/probe/pyproject.toml': `[project]
name = "tooling"
version = "0.0.0"
`,
    '.gspot/probe/.venv/installed': 'Absent_Package@2.0.0',
} as const;

/** pip-licenses entries with a Software Package Data Exchange (SPDX) expression, metadata, and trove classifiers. */
export const PYTHON_LICENSE_SOURCES = [
    { Name: 'expression', Version: '1.0.0', 'License-Expression': 'MIT', 'License-Metadata': 'GPL' },
    {
        Name: 'metadata',
        Version: '1.0.0',
        'License-Expression': 'UNKNOWN',
        'License-Metadata': 'Apache-2.0',
    },
    {
        Name: 'classifier',
        Version: '1.0.0',
        'License-Metadata': 'BSD',
        'License-Classifier': 'BSD License',
    },
    { Name: 'choice', Version: '1.0.0', 'License-Classifier': 'MIT License; Apache Software License' },
    {
        Name: 'copyleft',
        Version: '1.0.0',
        'License-Metadata': 'GPLv3',
        'License-Classifier': 'GNU General Public License v3 (GPLv3)',
    },
] as const;
