export const RELATIVE_PREFIXES = ['./', '../'] as const;
export const INTERNAL_PREFIXES = [...RELATIVE_PREFIXES, '@/', '#'] as const;
/** Test framework calls that load a named module. */
export const MODULE_MOCK_METHODS = {
    vi: new Set(['mock', 'doMock', 'importActual']),
    jest: new Set(['mock', 'doMock', 'requireActual']),
} as const;

export const DEFAULT_FOLDERS = ['*/*'] as const;
