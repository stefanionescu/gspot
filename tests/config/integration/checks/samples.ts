import { HELLO_EDGE_FUNCTION } from '#tests/config/checks/platform/supabase.ts';

export const ARITHMETIC_MODULE = `"""Arithmetic examples used by these tests."""

def double(value: int) -> int:
    """Double a number.

    Args:
        value: The number.

    Returns:
        Twice the number.

    """
    return value * 2

def triple(value: int) -> int:
    """Triple a number.

    Args:
        value: The number.

    Returns:
        Three times the number.

    """
    return value * 3
`;

export const SUPABASE_SANDBOX = {
    install: false,
    configurations: ['supabase'],

    without: ['typescript'],
    files: {
        'supabase/config.toml': `project_id = "example"

[functions.greet]
verify_jwt = true
`,
        'supabase/functions/greet/index.ts': HELLO_EDGE_FUNCTION,
    },
} as const;
