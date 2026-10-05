/** Native diagnostics distinguish Python correctness from conventions at each level. */
export const RULE_SOURCE = 'answer = missing_name\nprint(answer)\n';

/** This function exceeds thirty statements while staying below sixty code lines. */
export const FUNCTION_SOURCE = `"""An arithmetic example."""


def increase(value: int) -> int:
    """Increase a value through forty increments."""
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    value += 1
    return value
`;

/** Editor discovery must use each scope's formatter settings. */
export const FORMAT_CASES = [
    { file: 'sample.py', config: '.gspot/config/ruff.toml', formatted: "VALUE = 'example'\r\n" },
    { file: 'app/sample.py', config: '.gspot/config/app/ruff.toml', formatted: 'VALUE = "example"\n' },
] as const;

/** Python versions whose annotations require different runtime syntax. */
export const VERSION_CASES = [
    { scope: '', requires: '>=3.8,<4', generics: false, unions: false, annotation: 'Optional[List[int]]' },
    { scope: 'legacy', requires: '==3.9.*', generics: true, unions: false, annotation: 'Optional[List[int]]' },
    { scope: 'modern', requires: '~=3.10', generics: true, unions: true, annotation: 'list[int] | None' },
] as const;

/** Annotations must remain valid for the project's minimum Python version. */
export const VERSION_SOURCE = `"""Annotation examples."""

from typing import List, Optional


def retain(values: Optional[List[int]]) -> Optional[List[int]]:
    """Keep the supplied values."""
    return values
`;

/** Ruff owns unused imports; basedpyright retains the independent assignment error. */
export const DUPLICATE_SOURCE = '"""An example module."""\n\nimport math\n\nTOTAL: int = "one"\n';
