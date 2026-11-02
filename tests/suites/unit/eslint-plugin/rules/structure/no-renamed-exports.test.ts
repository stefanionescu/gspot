import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-renamed-exports', plugin.rules['no-renamed-exports'], {
    valid: [
        'export const API_URL = process.env.API_URL;',
        'export const API_URL = import.meta.env.API_URL;',
        'export const a = globalThis.settings.name;',
        'export const a = 1;',
        'const a = b;',
        'export let a = b;',
        'import settings from "./settings"; export const { homepage, license } = settings;',
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

buildRuleTester().run('no-renamed-exports regressions', plugin.rules['no-renamed-exports'], {
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
        {
            code: "export { owner as alias } from './owner';",
            name: 'a renamed re-export is the job of no-trivial-files',
        },
        { code: "import { owner } from './owner';\nexport { owner };", name: 'an import that keeps its name' },
        {
            code: "import { owner as alias } from './owner';\nexport { alias as owner };",
            name: 'an export that restores the imported name',
        },
    ],
    invalid: [
        {
            code: 'const owner = 1;\nexport { owner as alias };',
            name: 'an export specifier that renames a local value reports',
            errors: [{ messageId: 'renamed' }],
        },
        {
            code: "import { owner as alias } from './owner';\nexport { alias };",
            name: 'a rename made in the import and exported reports the imported name',
            errors: [{ messageId: 'renamed', data: { name: 'alias', source: 'owner' } }],
        },
        {
            code: "import { owner as local } from './owner';\nexport { local as alias };",
            name: 'a rename in the import and in the export names the imported value',
            errors: [{ messageId: 'renamed', data: { name: 'alias', source: 'owner' } }],
        },
        {
            code: 'const LEVELS = { all: 2 };\nexport const DEFAULT_LEVEL = LEVELS.all;',
            name: 'control: a member of a constant object that nothing assigns is a rename',
            errors: [{ messageId: 'renamed' }],
        },
        { code: 'import box from "x";\ntypeof box.a;\nexport const other = box;', errors: [{ messageId: 'renamed' }] },
        {
            code: 'import { "value" as other } from "a";\nexport { other as renamed };',
            errors: [{ messageId: 'renamed' }],
        },
        { code: 'const value = 1;\nexport { value as "renamed" };', errors: [{ messageId: 'renamed' }] },
    ],
});
