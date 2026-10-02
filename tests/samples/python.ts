// The planted Python projects of the Python kit tests.
export const STRUCTURE_INIT = [
    'init',
    '--yes',
    '--kits',
    'python',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];

export const TOOLS_CLEAN =
    '"""Arithmetic the planted tests call."""\n\n\ndef double(value: int) -> int:\n    """Double a number.\n\n    Args:\n        value (int): The number.\n\n    Returns:\n        int: Twice the number.\n\n    """\n    return value * 2\n';

export const TOOLS_MODULE = 'planted/math.py';

export const STRUCTURE_PROJECT =
    '[project]\nname = "planted"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = []\n';

/** The kits the Python structure sandbox leaves out after init. */
export const STRUCTURE_LEFT_OUT = ['naming', 'spelling', 'dependencies'];
