// The literal values acceptance/source/configurations/python reads: names, patterns, limits, and tables.

export const STRUCTURE_INIT = [
    'init',
    '--yes',
    '--configurations',
    'python',
    '--without',
    'naming',
    'spelling',
    'dependencies',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
export const STRUCTURE_CLEAN =
    '"""Prices."""\n\n\ndef _rounded(amount: float) -> float:\n    """Round to cents, half up."""\n    shifted = amount * 100\n    whole = int(shifted + 0.5)\n    return whole / 100\n\n\ndef total(prices: list[float]) -> float:\n    """Add prices and round the sum."""\n    summed = sum(prices)\n    checked = max(summed, 0.0)\n    return _rounded(checked) + _rounded(0.0)\n\n\n__all__ = ["total"]\n';
export const TOOLS_CLEAN =
    '"""Arithmetic the planted tests call."""\n\n\ndef double(value: int) -> int:\n    """Double a number.\n\n    Args:\n        value (int): The number.\n\n    Returns:\n        int: Twice the number.\n\n    """\n    return value * 2\n';
export const TOOLS_MODULE = 'planted/math.py';
export const STRUCTURE_PROJECT =
    '[project]\nname = "planted"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = []\n';
// The docstrings are Google style, and pydoclint reads that from the project, not from gspot (K-152).
export const TOOLS_PROJECT =
    '[project]\nname = "planted"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = []\n\n[tool.pydoclint]\nstyle = "google"\n';
