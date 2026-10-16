export const PYTHON_PROJECTS = ['uv.toml', 'pyproject.toml'] as const;

export const PYTHON_INSTALL_STEPS = [
    ['mise', 'trust', '.gspot/mise.toml'],
    ['mise', 'install', 'gitleaks', 'taplo', 'trufflehog', 'typos', 'vale', 'uv'],
    ['mise', 'bin-paths', 'gitleaks', 'taplo', 'trufflehog', 'typos', 'vale', 'uv'],
    ['uv', 'venv', '--python', '3.13.16', '--allow-existing', '.venv'],
    ['uv', 'sync', '--locked', '--no-install-project'],
] as const;

// The authored files every Python sandbox starts from.
export const PYTHON_SANDBOX_FILES = {
    'pyproject.toml': `[project]
name = "authored"
version = "1.0.0"
dependencies = ["authored-dependency"]
`,
    '.venv/authored.txt': 'keep the project environment',
    'source.py': 'import os\n',
} as const;

// The uv variables redirected to the sandbox.
export const UV_PROJECT_VARIABLES = ['UV_PROJECT', 'UV_WORKING_DIR', 'UV_PROJECT_ENVIRONMENT'] as const;

export const PYTHON_SANDBOX_IGNORES = [
    'files/v8r',
    'security/semgrep',
    'security/semgrep-registry',
    'format/editorconfig-checker',
    'python/basedpyright',
    'python/import-linter',
    'python/pydoclint',
    'python/deptry',
    'python/pyproject',
] as const;

export const PYTHON_INDEX_CREDENTIALS = { user: 'gspot', password: 'synthetic-uv-password' } as const;

export const PYTHON_TOOL_PROJECT = `[project]
name = "tools"
version = "0.0.0"
requires-python = "==3.13.16"
dependencies = ["Example.Package==1.2.3", "second-package==4.0.0"]

[tool.uv]
package = false
constraint-dependencies = ["transitive.package>=2.0.0"]
`;

export const PYTHON_TOOL_LOCKFILE = `version = 1
requires-python = "==3.13.16"

[manifest]
constraints = [{ name = "transitive-package", specifier = ">=2.0.0" }]

[[package]]
name = "tools"
version = "0.0.0"
source = { virtual = "." }
metadata = { requires-dist = [{ name = "second_package", specifier = "==4.0.0" }, { name = "example-package", specifier = "==1.2.3" }] }
`;

export const PYPROJECT_UV_INDEX = `[project]
name = "authored-project"

[tool.uv]
index-url = "https://example.com/simple"
find-links = ["wheels"]
`;

export const UV_TOML = `index-url = "https://alex:test%2Bpassword@example.com/simple"
find-links = ["wheels", "https://example.com/wheels"]
offline = true
resolution = "lowest-direct"

[[index]]
name = "local"
url = "packages"
`;

/** Captured project manifests distinguish declared scopes from workspace-only members. */
export const PYTHON_WORKSPACE_FILES = {
    'pyproject.toml': `[project]
dependencies = ["fastapi>=1"]
[tool.uv.workspace]
members = ["api", "member-only"]
`,
    'api/pyproject.toml': `[project]
name = "api"
dependencies = ["fastapi>=1"]
`,
    'api/main.py': 'print("ready")\n',
    'member-only/main.py': 'print("not a project file")\n',
} as const;

export const PYTHON_INDEX_NAME = 'gspot-test';

export const RUFF_VERSION_OUTPUT = /^ruff (?<version>\d+\.\d+\.\d[-+\w.]*)$/u;

export const UV_LOCKFILE_MISMATCHES = [
    ['Python version', '==3.13.16', '==3.13.15'],
    ['pin', '==4.0.0', '==5.0.0'],
    ['virtual root', 'virtual = "."', 'virtual = "elsewhere"'],
] as const;
