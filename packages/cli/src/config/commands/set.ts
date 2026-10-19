export const INTEGER = /^-?\d+$/u;

export const DECIMAL = /^-?\d+\.\d+$/u;

// An opening bracket identifies an intended list or table even without a closing bracket.
export const STRUCTURED = /^[[{]/u;

export const DASH_VALUE_HINT =
    'To pass a value that starts with -, put -- before the values: gspot set ci.setup_command -- bun install --frozen-lockfile.';
