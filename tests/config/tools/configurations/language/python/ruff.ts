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

/** Ruff 0.16.8 enabled sets captured from the original rule lists, after accepting F401. */
export const RULE_SELECTIONS = {
    recommended: {
        root: { count: 519, digest: '217b0e34e2e081d1053c99a05b3224cc10f1cb4d960135229e20b99c48a3a938' },
        app: { count: 540, digest: '6b47f251bff3a96b756b95c3452b606cab7f91d4ca7b1b46357e638934b2c7e4' },
    },
    all: {
        root: { count: 726, digest: 'cbd918719f4cd55a88ad08aefb04e6b4ff680f3580b6cc82ea46819df0d58761' },
        app: { count: 757, digest: '701586e8f6592e89e8d9fac39ba161f35215004d503e2de1dfdf830e8043366f' },
    },
} as const;

/** Every declared docstring convention preserves explicit rule choices at both levels. */
export const DOCSTRING_CONVENTIONS = ['', 'google', 'numpy', 'pep257'];

/** Ruff prints the selected rules separately from rules available to its fixer. */
export const ENABLED_RULES = /^linter\.rules\.enabled = \[([\s\S]*?)\n\]/mu;
export const RULE_CODES = /\(([A-Z]+\d+)\)/gu;
