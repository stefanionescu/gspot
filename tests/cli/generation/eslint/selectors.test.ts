import { test, expect } from 'bun:test';
import { selectorGroups } from '#cli/generation/eslint/blocks.ts';
import { STORE, RAW_SQL, INJECTED, PROCEDURE } from '#tests/config/cli/generation/eslint/selectors.ts';

test('general selectors form one group for every code file, in first-mention order', () => {
    expect(selectorGroups([STORE, PROCEDURE])).toStrictEqual([{ selectors: [STORE, PROCEDURE] }]);
});

test('an allowed path set gets its own group without the selector that allows it', () => {
    const groups = selectorGroups([STORE, { ...RAW_SQL, except: ['db/migrations/**'] }]);
    expect(groups).toStrictEqual([
        { selectors: [STORE, RAW_SQL] },
        { files: ['db/migrations/**'], selectors: [STORE] },
    ]);
});

test('a selector with files applies there together with the general ones', () => {
    const controllers = ['**/*.controller.ts'];
    const routers = ['**/routers/**/*.ts'];
    const groups = selectorGroups([
        STORE,
        { ...INJECTED, files: controllers },
        { ...PROCEDURE, files: routers },
        { ...RAW_SQL, files: controllers },
    ]);
    expect(groups).toStrictEqual([
        { selectors: [STORE] },
        { files: controllers, selectors: [STORE, INJECTED, RAW_SQL] },
        { files: routers, selectors: [STORE, PROCEDURE] },
    ]);
});

test('an empty allowed list adds no group', () => {
    expect(selectorGroups([{ ...RAW_SQL, except: [] }])).toStrictEqual([{ selectors: [RAW_SQL] }]);
});
