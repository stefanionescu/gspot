import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noRenamedExports } from '#eslint-plugin/rules/structure/no-renamed-exports.ts';

buildRuleTester().run('no-renamed-exports', noRenamedExports, {
    valid: [
        'export const API_URL = process.env.API_URL;',
        'export const a = globalThis.settings.name;',
        'export const a = 1;',
        'import settings from "./settings"; export const { homepage, [field]: value, ...rest } = settings;',
        {
            code: 'const main = () => 1;\nmain();\nexport { main as default };',
            name: 'a default export by specifier is not a second name',
        },
        {
            code: 'const owner = { value: 0 };\nexport const snapshot = owner.value;\nowner.value = 1;',
            name: 'a snapshot of a member that the module assigns later is not a rename',
        },
        {
            code: "export { owner as alias } from './owner';",
            name: 'a renamed re-export is the job of no-trivial-files',
        },
        {
            code: "import { owner as alias } from './owner';\nexport { alias as owner };",
            name: 'an export that restores the imported name',
        },
        'import { initial } from "./owner"; export let current = initial;',
        'import { "x-y" as alias } from "./owner";\nexport { alias as "x-y" };',
    ],
    invalid: [
        {
            code: 'import { b } from "./owner"; export const a = b;',
            errors: [{ messageId: 'renamed', data: { name: 'a', source: 'b' } }],
        },
        {
            code: 'import { b } from "./owner"; export const a = b.c.d;',
            errors: [{ messageId: 'renamed', data: { name: 'a', source: 'b.c.d' } }],
        },
        {
            code: 'const b = 1; export const a = b as B;',
            errors: [{ messageId: 'renamed', data: { name: 'a', source: 'b as B' } }],
        },
        {
            code: 'import { b, d } from "./owner"; export const a = b, c = d;',
            errors: [
                { messageId: 'renamed', data: { name: 'a', source: 'b' } },
                { messageId: 'renamed', data: { name: 'c', source: 'd' } },
            ],
        },
        {
            code: 'import settings from "./settings"; export const { owner: { name: OWNER } = {}, "home-page": homePage } = settings;',
            errors: [
                { messageId: 'renamed', data: { name: 'OWNER', source: 'name' } },
                { messageId: 'renamed', data: { name: 'homePage', source: 'home-page' } },
            ],
        },
        {
            code: 'export const { license: LICENSE = "MIT" } = build();',
            errors: [{ messageId: 'renamed', data: { name: 'LICENSE', source: 'license' } }],
        },
        {
            code: 'const owner = 1;\nexport { owner as alias };',
            name: 'an export specifier that renames a local value reports',
            errors: [{ messageId: 'renamed', data: { name: 'alias', source: 'owner' } }],
        },
        {
            code: "import { owner as alias } from './owner';\nexport { alias };",
            name: 'a rename made in the import and exported reports the imported name',
            errors: [{ messageId: 'renamed', data: { name: 'alias', source: 'owner' } }],
        },
        {
            code: 'import box from "x";\ntypeof box.a;\nexport const other = box;',
            errors: [{ messageId: 'renamed', data: { name: 'other', source: 'box' } }],
        },
        {
            code: 'const value = 1;\nexport { value as "renamed" };',
            errors: [{ messageId: 'renamed', data: { name: 'renamed', source: 'value' } }],
        },
    ],
});
