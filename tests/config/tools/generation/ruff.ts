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
