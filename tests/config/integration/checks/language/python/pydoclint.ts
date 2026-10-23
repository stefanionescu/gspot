/** The JSON check command for each docstring case. */
export const PYDOCLINT_CHECK_ARGUMENTS = ['check', '--only', 'python/pydoclint', '--json'] as const;

/** Google and NumPy docstrings with no project style; the check must apply the style of each file. */
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

/** The rules that pydoclint reports on each function of the arithmetic module when your settings ask for types. */
export const TYPED_DOCSTRING_RULES = ['DOC109', 'DOC110', 'DOC105', 'DOC203'] as const;
