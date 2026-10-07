export const PRIVATE_PYTHON_PROJECT = `[project]
name = "gspot-tools"
version = "0.0.0"
requires-python = ">=3.11"
dependencies = ["Example.Package==1.2.3", "second-package==4.0.0"]

[tool.uv]
package = false
constraint-dependencies = ["transitive.package>=2.0.0"]
`;

export const PRIVATE_PYTHON_LOCKFILE = `version = 1
requires-python = ">=3.11"

[manifest]
constraints = [{ name = "transitive-package", specifier = ">=2.0.0" }]

[[package]]
name = "gspot-tools"
version = "0.0.0"
source = { virtual = "." }
metadata = { requires-dist = [{ name = "second_package", specifier = "==4.0.0" }, { name = "example-package", specifier = "==1.2.3" }] }
`;

export const PROJECT_INDEX = `[project]
name = "authored-project"

[tool.uv]
index-url = "https://example.com/simple"
find-links = ["wheels"]
`;

export const AUTHORED_UV_INDEX = `index-url = "https://alex:test%2Bpassword@example.com/simple"
find-links = ["wheels", "https://example.com/wheels"]
offline = true
resolution = "lowest-direct"

[[index]]
name = "local"
url = "packages"
`;

export const UV_LOCKFILE_MISMATCHES = [
    ['Python floor', '>=3.11', '>=3.12'],
    ['constraint', '>=2.0.0', '>=3.0.0'],
    ['pin', '==4.0.0', '==5.0.0'],
    ['virtual root', 'virtual = "."', 'virtual = "elsewhere"'],
] as const;
