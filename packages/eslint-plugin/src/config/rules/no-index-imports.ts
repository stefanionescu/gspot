import { RELATIVE_PREFIXES } from './imports.ts';

export const INTERNAL_PREFIXES = [...RELATIVE_PREFIXES, '@/', '~/', '#'] as const;

export const MODULE_MOCK_METHODS = {
    vi: new Set(['mock', 'doMock', 'importActual']),
    jest: new Set(['mock', 'doMock', 'requireActual']),
} as const;
