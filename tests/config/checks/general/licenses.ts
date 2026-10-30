import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';

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

export const SAMPLE_PYPROJECT = `[project]
name = "sample"
version = "0.0.0"
`;

export const LICENSE_PACKAGE_JSON = '{"name":"example","private":true,"dependencies":{"choice":"1.0.0"}}';

export const UNINSTALLED_DEPENDENCY_CASES = [
    { scope: '', dependencyFile: 'package.json', text: LICENSE_PACKAGE_JSON, installedFolder: 'node_modules' },
    { scope: '', dependencyFile: 'pyproject.toml', text: SAMPLE_PYPROJECT, installedFolder: '.venv' },
    {
        scope: 'apps/example',
        dependencyFile: 'package.json',
        text: LICENSE_PACKAGE_JSON,
        installedFolder: 'node_modules',
    },
    { scope: 'apps/example', dependencyFile: 'pyproject.toml', text: SAMPLE_PYPROJECT, installedFolder: '.venv' },
] as const;

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

export const LICENSE_TOOL_PROJECT_FILES = {
    [`${GSPOT_FOLDER}/probe/pyproject.toml`]: `[project]
name = "tooling"
version = "0.0.0"
`,
    [`${GSPOT_FOLDER}/probe/.venv/installed`]: 'Absent_Package@2.0.0',
} as const;

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

export const LOCKED_PACKAGE_CASES = [
    {
        name: 'npm transitive packages',
        file: 'package-lock.json',
        text: '{"lockfileVersion":3,"packages":{"":{"name":"app"},"node_modules/zod":{"version":"4.0.0"},"node_modules/@img/sharp-libvips-linux-x64":{"version":"1.2.0","optional":true},"node_modules/a/node_modules/b":{"version":"2.0.0"}}}',
        expected: ['@img/sharp-libvips-linux-x64@1.2.0', 'b@2.0.0', 'zod@4.0.0'],
    },
    {
        name: 'Bun transitive packages',
        file: 'bun.lock',
        text: '{\n  "lockfileVersion": 1,\n  "workspaces": { "": { "name": "app" } },\n  "packages": {\n    "zod": ["zod@4.0.0", "", {}, "sha512-a"],\n    "@scope/tool": ["@scope/tool@1.2.3", "", {}, "sha512-b"],\n  },\n}\n',
        expected: ['@scope/tool@1.2.3', 'zod@4.0.0'],
    },
    {
        name: 'pnpm peer package versions',
        file: 'pnpm-lock.yaml',
        text: "lockfileVersion: '9.0'\npackages:\n  zod@4.0.0:\n    resolution: {integrity: sha512-a}\n  react-dom@19.0.0(react@19.0.0):\n    resolution: {integrity: sha512-b}\n",
        expected: ['react-dom@19.0.0', 'zod@4.0.0'],
    },
    {
        name: 'Yarn Berry scoped packages',
        file: 'yarn.lock',
        text: '__metadata:\n  version: 8\n\n"zod@npm:^4.0.0":\n  version: 4.0.0\n\n"@scope/tool@npm:^1.0.0, @scope/tool@npm:^1.2.0":\n  version: 1.2.3\n',
        expected: ['@scope/tool@1.2.3', 'zod@4.0.0'],
    },
    {
        name: 'uv normalized names',
        file: 'uv.lock',
        text: 'version = 1\n[[package]]\nname = "Typing_Extensions"\nversion = "4.12.2"\n[[package]]\nname = "app"\nversion = "0.1.0"\n',
        expected: ['app@0.1.0', 'typing-extensions@4.12.2'],
    },
    {
        name: 'uv package without dependency versions',
        file: 'uv.lock',
        text: 'version = 1\n[[package]]\nname = "App"\nversion = "1.0"\n[package.metadata]\nrequires-dist = [{ name = "unpinned" }]\n',
        expected: ['app@1.0'],
    },
] as const;
