import { test, mock, expect } from 'bun:test';
import { setRuntime, setImportLookup } from '#cli/configurations/language/javascript/files/eslint-functions.ts';

test('a runtime that the globals package does not name stops the config', () => {
    expect(() => setRuntime({}, { node: {}, browser: {} }, 'nodejs', 'module')).toThrow(
        'The globals package has no runtime named nodejs. Set tools.eslint.override.runtime to one of: node, browser.',
    );
});

test('every block of a config shares one TypeScript import resolver', () => {
    const createLookup = mock(() => ({}));
    const first = setImportLookup({}, createLookup, ['tsconfig.json']);
    const second = setImportLookup({}, createLookup, ['tsconfig.json']);
    expect(createLookup).toHaveBeenCalledTimes(1);
    expect(first.settings).toStrictEqual(second.settings);
});
