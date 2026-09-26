import { tester } from '#tests/support/plugin/tester.ts';
import { plantedRoot } from '#tests/support/plugin/planted.ts';
import { noDuplicateBarrelExports } from '#plugin/rules/no-duplicate-barrel-exports.ts';

const root = await plantedRoot({
    'defaults.ts': 'const value = 1; export {value as default};',
    'a.ts': 'export const one = 1;\nexport const two = 2;\n',
    'b.ts': 'export const two = 22;\nexport function three() {}\n',
    'bindings.ts':
        'export const first = 1, second = 2; export const {one: renamed, nested: [deep], ...rest} = value; export const [head, , ...tail] = value;',
    'comments.ts': '// export const one = 1;\n/* export {two}; */ export const real = 1;',
    'cycle.ts': "export * from './cycle'; export * from './c'; export * as group from './a'; export default 1;",
    'c.ts': "export * from './a';\n",
});

tester().run('no-duplicate-barrel-exports', noDuplicateBarrelExports, {
    valid: [
        { code: "export * from './defaults'; export { default } from './defaults';", filename: `${root}/index.ts` },
        { code: "export * from './comments'; export * from './a';", filename: `${root}/index.ts` },
        { code: "export * as group from './a'; export * from './a';", filename: `${root}/index.ts` },
        { code: "export * from './a';\nexport { three } from './b';", filename: `${root}/index.ts` },
        { code: "export * from './a';\nexport * from './b';", filename: `${root}/not-index.ts` },
        { code: 'export const x = 1;\nexport const y = 2;', filename: `${root}/index.ts` },
    ],
    invalid: [
        ...['second', 'renamed', 'deep', 'rest', 'head', 'tail'].map((name) => ({
            code: `export * from './bindings'; export { ${name} } from './bindings';`,
            filename: `${root}/index.ts`,
            errors: [{ messageId: 'duplicate' as const, data: { name } }],
        })),
        {
            code: "export * from './cycle'; export { one } from './a'; export * as group from './b';",
            filename: `${root}/index.ts`,
            errors: [
                { messageId: 'duplicate', data: { name: 'one' } },
                { messageId: 'duplicate', data: { name: 'group' } },
            ],
        },
        {
            code: "export const {one} = value; export {one} from './a';",
            filename: `${root}/index.ts`,
            errors: [{ messageId: 'duplicate', data: { name: 'one' } }],
        },
        {
            code: "export * from './a';\nexport * from './b';",
            filename: `${root}/index.ts`,
            errors: [{ messageId: 'duplicate', data: { name: 'two' } }],
        },
        {
            code: "export { one } from './a';\nexport const one = 3;",
            filename: `${root}/index.ts`,
            errors: [{ messageId: 'duplicate', data: { name: 'one' } }],
        },
        {
            code: "export * from './c';\nexport { one } from './a';",
            filename: `${root}/index.ts`,
            errors: [{ messageId: 'duplicate', data: { name: 'one' } }],
        },
    ],
});
