import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { PYTHON_VERSION } from '#cli/config/installers/pypi.ts';

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
requires-python = "==${PYTHON_VERSION}"
dependencies = ["Example.Package==1.2.3", "second-package==4.0.0"]

[tool.uv]
package = false
constraint-dependencies = ["transitive.package>=2.0.0"]
`;

export const PYTHON_TOOL_LOCKFILE = `version = 1
requires-python = "==${PYTHON_VERSION}"

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

export const UV_LOCKFILE_ORIGINS = [
    ['https://pypi.org/simple', 'https://files.pythonhosted.org/example.whl', true, {}],
    ['https://attacker.example/simple', 'https://files.pythonhosted.org/example.whl', false, {}],
    ['https://pypi.org/simple', 'https://attacker.example/example.whl', false, {}],
    [
        'https://pypi.org/simple',
        'https://files.pythonhosted.org/example.whl',
        false,
        { 'index-url': 'https://packages.example/simple' },
    ],
    [
        'https://packages.example/simple',
        'https://packages.example/example.whl',
        true,
        { 'index-url': 'https://packages.example/simple' },
    ],
    [
        'https://pypi.org/simple',
        'https://files.pythonhosted.org/example.whl',
        false,
        { index: [{ url: 'https://packages.example/simple', default: true }] },
    ],
    [
        'https://packages.example/simple',
        'https://files.pythonhosted.org/example.whl',
        true,
        { index: [{ url: 'https://packages.example/simple', default: true }] },
    ],
    [
        'https://pypi.org/simple',
        'https://files.pythonhosted.org/example.whl',
        true,
        { index: [{ url: 'https://packages.example/simple' }] },
    ],
] satisfies [string, string, boolean, Record<string, unknown>][];

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

export const INVALID_UV_SETTINGS = [
    { file: 'uv.toml', field: 'find-links', text: 'find-links = "https://example.com/wheels"\n' },
    { file: 'uv.toml', field: 'index', text: 'index = "x"\n' },
    {
        file: 'pyproject.toml',
        field: 'tool.uv.find-links',
        text: '[tool.uv]\nfind-links = "https://example.com/wheels"\n',
    },
    { file: 'pyproject.toml', field: 'tool.uv.index', text: '[tool.uv]\nindex = "x"\n' },
];

export const PYTHON_RELEASE_AGE = {
    days: 7,
    npmExclusions: [],
    pythonExclusions: ['ruff', 'semgrep'],
};

export const PYTHON_INSTALL_FILES = {
    'gspot.toml': 'configurations = []\n[rules]\nenabled = false\n',
    [GSPOT_PATHS.pythonProject]: PYTHON_TOOL_PROJECT,
    [GSPOT_PATHS.uvLockfile]: PYTHON_TOOL_LOCKFILE,
    'uv.toml': UV_TOML,
};
