import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/eslint/rule-tester.ts';

createRuleTester().run('no-renamed-exports', plugin.rules['no-renamed-exports'], {
    valid: [
        'export const API_URL = process.env.API_URL;',
        'export const API_URL = import.meta.env.API_URL;',
        'export const a = globalThis.settings.name;',
        'export const a = 1;',
        'export const a = build(b);',
        'export const a = { ...b };',
        'const a = b;',
        'export let a = b;',
        'import settings from "./settings"; export const { homepage, license } = settings;',
        'import settings from "./settings"; const { homepage: SITE_URL } = settings; console.log(SITE_URL);',
        'import settings from "./settings"; export const { owner: { name } } = settings;',
    ],
    invalid: [
        {
            code: 'import { b } from "./owner"; export const a = b;',
            errors: [{ messageId: 'renamed', data: { name: 'a', source: 'b' } }],
        },
        { code: 'import { b } from "./owner"; export const a = b.c.d;', errors: [{ messageId: 'renamed' }] },
        { code: 'const b = 1; export const a = b as B;', errors: [{ messageId: 'renamed' }] },
        {
            code: 'import { b, d } from "./owner"; export const a = b!, c = d;',
            errors: [{ messageId: 'renamed' }, { messageId: 'renamed' }],
        },
        {
            code: 'import settings from "./settings"; export const { homepage: SITE_URL } = settings;',
            errors: [{ messageId: 'renamed', data: { name: 'SITE_URL', source: 'homepage' } }],
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
    ],
});

createRuleTester().run('no-renamed-exports regressions', plugin.rules['no-renamed-exports'], {
    valid: [
        {
            code: 'const main = () => 1;\nmain();\nexport { main as default };',
            name: 'a default export by specifier is not a second name',
        },
        {
            code: 'const owner = { value: 0 };\nexport const snapshot = owner.value;\nowner.value = 1;',
            name: 'a snapshot of a member that the module assigns later is not a rename',
        },
        "export { default as Button } from './Button';",
    ],
    invalid: [
        {
            code: 'const owner = 1;\nexport { owner as alias };',
            name: 'an export specifier that renames a local value reports',
            errors: [{ messageId: 'renamed' }],
        },
        {
            code: "export { owner as alias } from './owner';",
            name: 'a re-export that renames a named export reports',
            errors: [{ messageId: 'renamed' }],
        },
        {
            code: 'const LEVELS = { all: 2 };\nexport const DEFAULT_LEVEL = LEVELS.all;',
            name: 'control: a member of a constant object that nothing assigns is a rename',
            errors: [{ messageId: 'renamed' }],
        },
    ],
});
