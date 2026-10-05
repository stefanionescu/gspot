import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';
import { MODULE_PATH, CLEAN_MODULE } from '#tests/config/samples/python/source.ts';

// What each check accepts beside the clean module.
export const CORRECTIONS: Record<string, Record<string, string>> = {
    'python/vulture': { 'example/unused.py': '"""No unused imports."""\n' },
    'python/pip-installs': {
        'uv.lock': 'version = 1\n',
        'scripts/setup.sh': '#!/usr/bin/env bash\nprintf "Dependencies are owned by pyproject.toml\\n"\n',
    },
    'python/stale-exclusions': { 'example/gone.py': '"""A file with a separate dependency set."""\n' },
};

// The docstrings are Google style, and pydoclint reads that from the project, not from gspot.
export const TOOLS_PROJECT =
    '[project]\nname = "example"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = []\n\n[tool.pydoclint]\nstyle = "google"\n';

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['python'],
    modules: false,
    without: ['naming', 'spelling', 'dependencies'],
    tools: ['ruff', 'basedpyright'],
    files: {
        'pyproject.toml': TOOLS_PROJECT,
        'example/__init__.py': '"""The test package."""\n',
        [MODULE_PATH]: CLEAN_MODULE,
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'python/ruff',
        files: {
            [MODULE_PATH]: `${CLEAN_MODULE}\n\ndef run(code: str) -> object:\n    """Run code.\n\n    Args:\n        code (str): The code.\n\n    Returns:\n        object: What it gave.\n\n    """\n    return eval(code)\n`,
        },
        expected: { file: MODULE_PATH, rule: 'S307', line: 27 },
    },
    {
        check: 'python/ruff-format',
        files: {
            [MODULE_PATH]:
                '"""Arithmetic examples used by these tests."""\n\n\ndef double(value: int) -> int:\n    """Double a number.\n\n    Args:\n        value (int): The number.\n\n    Returns:\n        int: Twice the number.\n\n    """\n    return value*2\n',
        },
        expected: { file: MODULE_PATH },
    },
    {
        check: 'python/basedpyright',
        files: {
            [MODULE_PATH]:
                '"""Arithmetic examples used by these tests."""\n\n\ndef double(value: int) -> int:\n    """Double a number.\n\n    Args:\n        value (int): The number.\n\n    Returns:\n        int: Twice the number.\n\n    """\n    return str(value)\n',
        },
        expected: { file: MODULE_PATH, rule: 'reportReturnType', line: 14 },
    },
    {
        check: 'python/pydoclint',
        files: {
            [MODULE_PATH]:
                '"""Arithmetic examples used by these tests."""\n\n\ndef double(value: int) -> int:\n    """Double a number.\n\n    Args:\n        amount (int): The number.\n\n    Returns:\n        int: Twice the number.\n\n    """\n    return value * 2\n',
        },
        expected: { file: MODULE_PATH, rule: 'DOC103', line: 4 },
    },
    {
        check: 'python/vulture',
        files: { 'example/unused.py': '"""A module that imports what it never uses."""\n\nimport colorsys\n' },
        expected: { file: 'example/unused.py', line: 3 },
    },
    {
        check: 'python/pyproject',
        files: {
            'pyproject.toml':
                '[project]\nname = "example"\nversion = 7\nrequires-python = ">=3.12"\ndependencies = []\n\n[tool.pydoclint]\nstyle = "google"\n',
        },
        expected: { file: 'pyproject.toml' },
    },
];

/** Unconfigured Google and NumPy docstrings must use the style of each source file. */
export const DOCSTRING_MODULES = {
    'google.py':
        'def double(value: int) -> int:\n    """Double a number.\n\n    Args:\n        amount: The number.\n\n    Returns:\n        Twice the number.\n    """\n    return value * 2\n',
    'numpy.py':
        'EXAMPLE = """\nArgs:\n"""\n\ndef double(value: int) -> int:\n    """Double a number.\n\n    Parameters\n    ----------\n    amount\n        The number.\n\n    Returns\n    -------\n    The doubled number.\n    """\n    return value * 2\n',
};

/** Native import-linter configuration formats, with the same forbidden dependency. */
export const IMPORT_CONFIGURATIONS = [
    {
        file: 'setup.cfg',
        text: '[importlinter]\nroot_package = example\n\n[importlinter:contract:layers]\nname = Domain boundary\ntype = forbidden\nsource_modules = example.low\nforbidden_modules = example.high\n',
    },
    {
        file: '.importlinter',
        text: '[importlinter]\nroot_package = example\n\n[importlinter:contract:layers]\nname = Domain boundary\ntype = forbidden\nsource_modules = example.low\nforbidden_modules = example.high\n',
    },
    {
        file: 'pyproject.toml',
        text: '[tool.importlinter]\nroot_package = "example"\n\n[[tool.importlinter.contracts]]\nname = "Domain boundary"\ntype = "forbidden"\nsource_modules = ["example.low"]\nforbidden_modules = ["example.high"]\n',
    },
];
