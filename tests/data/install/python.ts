import { PYTHON_VERSION } from '#cli/config/generation/projects.ts';

export const UV_TOML = `index-url = "https://alex:test%2Bpassword@example.com/simple"
find-links = ["wheels", "https://example.com/wheels"]
offline = true
resolution = "lowest-direct"

[[index]]
name = "local"
url = "packages"
`;

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

export const UV_LOCKFILE_MISMATCHES = [
    ['Python version', `==${PYTHON_VERSION}`, '==3.13.15'],
    ['pin', '==4.0.0', '==5.0.0'],
    ['virtual root', 'virtual = "."', 'virtual = "elsewhere"'],
] as const;

/** The install error of a password in a new uv lockfile. */
export const LOCKFILE_PASSWORD_ERROR = {
    name: 'GspotError',
    code: 'install',
    message:
        'The uv lockfile holds the index credentials of the repository. gspot kept the existing files. Remove the credentials from the index URL.',
} as const;

export const PYPROJECT_UV_INDEX = `[project]
name = "authored-project"

[tool.uv]
index-url = "https://example.com/simple"
find-links = ["wheels"]
`;
