import { PYPROJECT } from '#tests/data/checks/python/project.ts';

// import-linter output with two broken contracts, each with its own import chain.
const IMPORT_CONTRACT_REPORT = `Contracts
---------

First boundary BROKEN (1 ignored import)
Second boundary BROKEN [0.1s]

[1mBroken contracts[0m
----------------
[1mFirst boundary[0m
--------------
example.low -> example.high (l. 1)

Second boundary
---------------
example.other -> example.high (l. 3)
`;

const IMPORT_BOUNDARY_SETTINGS = `[importlinter]
root_package = example

[importlinter:contract:layers]
name = Domain boundary
type = forbidden
source_modules = example.low
forbidden_modules = example.high
`;

/** Each file format that import-linter reads, with the same forbidden import. */
const IMPORT_CONFIGURATIONS = [
    {
        file: 'setup.cfg',
        text: IMPORT_BOUNDARY_SETTINGS,
    },
    {
        file: '.importlinter',
        text: IMPORT_BOUNDARY_SETTINGS,
    },
    {
        file: 'pyproject.toml',
        text: `[tool.importlinter]
root_package = "example"

[[tool.importlinter.contracts]]
name = "Domain boundary"
type = "forbidden"
source_modules = ["example.low"]
forbidden_modules = ["example.high"]
`,
    },
] as const;

/** The settings of the import-linter cases: one Python scope inside the root project. */
const IMPORT_SCOPE_SETTINGS = `[[scope]]
path = "app"

configurations = ["python"]
`;

/** The package in each project; low imports high, which every contract forbids. */
const IMPORT_PACKAGE_FILES = Object.fromEntries(
    ['', 'app/'].flatMap((scope) => [
        [scope + 'pyproject.toml', PYPROJECT],
        [scope + 'example/__init__.py', ''],
        [scope + 'example/low.py', 'import example.high\n'],
        [scope + 'example/high.py', ''],
    ]),
);

/** One installed Python tool project serves every import-linter case. */
const IMPORT_LINTER_SANDBOX = { configurations: ['python'], files: IMPORT_PACKAGE_FILES } as const;

export {
    IMPORT_PACKAGE_FILES,
    IMPORT_CONFIGURATIONS,
    IMPORT_LINTER_SANDBOX,
    IMPORT_SCOPE_SETTINGS,
    IMPORT_CONTRACT_REPORT,
};
