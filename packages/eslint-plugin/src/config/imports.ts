export const RELATIVE_PREFIXES = ['./', '../'] as const;
export const INTERNAL_PREFIXES = [...RELATIVE_PREFIXES, '@/', '#'] as const;
export const MODULE_MOCK_METHODS = {
    vi: new Set(['mock', 'doMock', 'importActual']),
    jest: new Set(['mock', 'doMock', 'requireActual']),
} as const;

export const DEFAULT_BOUNDARY_FOLDERS = ['*/*'] as const;
