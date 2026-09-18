import { tester } from '#plugin-tests/harness/tester.ts';
import { plantedRoot } from '#plugin-tests/harness/planted.ts';
import { noDuplicateBarrelExports } from '#plugin/rules/no-duplicate-barrel-exports.ts';

const root = await plantedRoot({
    'a.ts': 'export const one = 1;\nexport const two = 2;\n',
    'b.ts': 'export const two = 22;\nexport function three() {}\n',
    'c.ts': "export * from './a';\n",
});

tester().run('no-duplicate-barrel-exports', noDuplicateBarrelExports, {
    valid: [
        { code: "export * from './a';\nexport { three } from './b';", filename: `${root}/index.ts` },
        { code: "export * from './a';\nexport * from './b';", filename: `${root}/not-index.ts` },
        { code: 'export const x = 1;\nexport const y = 2;', filename: `${root}/index.ts` },
    ],
    invalid: [
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
