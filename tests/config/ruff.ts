/** Native diagnostics distinguish Python correctness from conventions at each level. */
const RUFF_RULE_SOURCE = 'answer = missing_name\nprint(answer)\n';

/** This function exceeds thirty statements while staying below sixty code lines. */
const FUNCTION_INCREMENT_COUNT = 40;

const FUNCTION_SOURCE = `"""An arithmetic example."""


def increase(value: int) -> int:
    """Increase a value through forty increments."""
${Array.from({ length: FUNCTION_INCREMENT_COUNT }, () => '    value += 1').join('\n')}
    return value
`;

/** Editor discovery must use each scope's formatter settings. */
const RUFF_FORMAT_CASES = [
    { file: 'sample.py', config: '.gspot/config/ruff.toml', formatted: "VALUE = 'example'\r\n" },
    { file: 'app/sample.py', config: '.gspot/config/app/ruff.toml', formatted: 'VALUE = "example"\n' },
] as const;

/** Python versions whose annotations require different runtime syntax. */
const RUFF_VERSION_CASES = [
    { scope: '', requires: '>=3.8,<4', generics: false, unions: false, annotation: 'Optional[List[int]]' },
    { scope: 'legacy', requires: '==3.9.*', generics: true, unions: false, annotation: 'Optional[List[int]]' },
    { scope: 'modern', requires: '~=3.10', generics: true, unions: true, annotation: 'list[int] | None' },
] as const;

/** Annotations must remain valid for the project's minimum Python version. */
const VERSION_SOURCE = `"""Annotation examples."""

from typing import List, Optional


def retain(values: Optional[List[int]]) -> Optional[List[int]]:
    """Keep the supplied values."""
    return values
`;

/** Ruff owns unused imports; basedpyright retains the independent assignment error. */
const DUPLICATE_IMPORT_SOURCE = `"""An example module."""

import math

TOTAL: int = "one"
`;

const RUFF_RULE_ARGUMENTS = ['rule', '--all', '--output-format', 'json'] as const;
const RUFF_FORMAT_ARGUMENTS = ['format', '--check', '--no-cache'] as const;

export {
    VERSION_SOURCE,
    FUNCTION_SOURCE,
    RUFF_RULE_SOURCE,
    RUFF_FORMAT_CASES,
    RUFF_VERSION_CASES,
    RUFF_RULE_ARGUMENTS,
    RUFF_FORMAT_ARGUMENTS,
    DUPLICATE_IMPORT_SOURCE,
};
