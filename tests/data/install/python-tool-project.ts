import { PYTHON_VERSION } from '#cli/config/generation/projects.ts';

export const PYTHON_PROJECTS = ['uv.toml', 'pyproject.toml'] as const;

export const PYTHON_INSTALL_STEPS = [
    ['uv', 'venv', '--python', '{python-version}', '--allow-existing', '.venv'],
    ['uv', 'sync', '--locked', '--no-install-project', '--python', '{python-version}'],
] as const;

export const PYTHON_TOOL_PROJECT = `[project]
name = "tools"
version = "0.0.0"
requires-python = "=={python-version}"
dependencies = ["Example.Package==1.2.3", "second-package==4.0.0"]

[tool.uv]
package = false
constraint-dependencies = ["transitive.package>=2.0.0"]
`;

export const PYTHON_TOOL_LOCKFILE = `version = 1
requires-python = "=={python-version}"

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

/** pyproject.toml files, to tell declared scopes from uv workspace members. */
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

export const UV_LOCKFILE_MISMATCHES = [
    ['Python version', `==${PYTHON_VERSION}`, '==3.13.15'],
    ['pin', '==4.0.0', '==5.0.0'],
    ['virtual root', 'virtual = "."', 'virtual = "elsewhere"'],
] as const;
