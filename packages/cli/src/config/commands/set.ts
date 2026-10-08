export const INTEGER = /^-?\d+$/u;

export const DECIMAL = /^-?\d+\.\d+$/u;

// An opening bracket identifies an intended list or table even without a closing bracket.
export const STRUCTURED = /^[[{]/u;
