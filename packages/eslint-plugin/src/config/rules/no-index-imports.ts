export const LOCAL_PREFIXES = ['./', '../', '@/', '~/', '#'] as const;

export const MODULE_MOCK_METHODS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    ['vi', new Set(['mock', 'doMock', 'unmock', 'doUnmock', 'importActual', 'importMock'])],
    [
        'jest',
        new Set([
            'mock',
            'doMock',
            'unmock',
            'dontMock',
            'setMock',
            'requireActual',
            'requireMock',
            'createMockFromModule',
        ]),
    ],
]);
