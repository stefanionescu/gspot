import { SHOWN_FUNCTION } from '#tests/config/python/docstrings.ts';
import { PYTHON_MODULE_HEADER } from '#tests/config/python/modules.ts';

// Native import-linter output keeps two broken contracts and their distinct dependency chains.
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

/** Native import-linter configuration formats, with the same forbidden dependency. */
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

const EXPORT_ORDER_FILES = {
    'example/top.py': `${PYTHON_MODULE_HEADER}__all__ = ["shown"]


${SHOWN_FUNCTION}`,
    'example/listed.py': `${PYTHON_MODULE_HEADER}${SHOWN_FUNCTION}

def ab() -> int:
    """Give two."""
    return 2


__all__ = ["shown", "ab"]
`,
    'example/__init__.py': `${PYTHON_MODULE_HEADER}__all__ = ["a", "b", "c"]\n`,
} as const;

export { EXPORT_ORDER_FILES, IMPORT_CONFIGURATIONS, IMPORT_CONTRACT_REPORT };
