import { expect, test } from 'bun:test';
import { selectorGroups } from '#cli/generation/eslint.ts';

const store = { selector: 'CallExpression[callee.name=/Store$/]', message: 'Pass a selector to the store hook.' };
const rawSql = { selector: "TaggedTemplateExpression[tag.name='sql']", message: 'Use the query builder.' };
const procedure = { selector: "CallExpression[callee.property.name='query']", message: 'Give the procedure an input.' };
const injected = { selector: "Decorator[expression.callee.name='InjectRepository']", message: 'Inject the service.' };

test('no selected fragment selectors means no restricted-syntax group', () => {
    expect(selectorGroups([])).toStrictEqual([]);
});

test('general selectors form one group for every code file, in first-mention order', () => {
    expect(selectorGroups([store, procedure])).toStrictEqual([{ selectors: [store, procedure] }]);
});

test('an allowed path set gets its own group without the selector that allows it', () => {
    const groups = selectorGroups([store, { ...rawSql, except: ['db/migrations/**'] }]);
    expect(groups).toStrictEqual([{ selectors: [store, rawSql] }, { files: ['db/migrations/**'], selectors: [store] }]);
});

test('a selector with files applies there together with the general ones', () => {
    const controllers = ['**/*.controller.ts'];
    const routers = ['**/routers/**/*.ts'];
    const groups = selectorGroups([
        store,
        { ...injected, files: controllers },
        { ...procedure, files: routers },
        { ...rawSql, files: controllers },
    ]);
    expect(groups).toStrictEqual([
        { selectors: [store] },
        { files: controllers, selectors: [store, injected, rawSql] },
        { files: routers, selectors: [store, procedure] },
    ]);
});

test('an empty allowed list adds no group', () => {
    expect(selectorGroups([{ ...rawSql, except: [] }])).toStrictEqual([{ selectors: [rawSql] }]);
});
