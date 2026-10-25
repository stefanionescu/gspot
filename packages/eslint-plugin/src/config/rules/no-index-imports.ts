import { RELATIVE_PREFIXES } from './imports.ts';

export const LOCAL_PREFIXES = [...RELATIVE_PREFIXES, '@/', '~/', '#'] as const;

export const MODULE_MOCK_METHODS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    ['vi', new Set(['mock', 'doMock', 'importActual'])],
    ['jest', new Set(['mock', 'doMock', 'requireActual'])],
]);
