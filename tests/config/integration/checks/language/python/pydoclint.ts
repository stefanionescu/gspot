export const PYDOCLINT_CHECK_ARGUMENTS = ['check', '--only', 'python/pydoclint', '--json'] as const;

export const DOCSTRING_MODULES = {
    'google.py': `def double(value: int) -> int:
    """Double a number.

    Args:
        amount: The number.

    Returns:
        Twice the number.
    """
    return value * 2
`,
    'numpy.py': `EXAMPLE = """
Args:
"""

def double(value: int) -> int:
    """Double a number.

    Parameters
    ----------
    amount
        The number.

    Returns
    -------
    The doubled number.
    """
    return value * 2
`,
} as const;

export const TYPED_DOCSTRING_RULES = ['DOC109', 'DOC110', 'DOC105', 'DOC203'] as const;
