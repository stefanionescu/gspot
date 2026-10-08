import plugin from '#plugin/rules/public.ts';
import { createRuleTester } from '#tests/harness/rule-tester.ts';

createRuleTester().run('sort-exports', plugin.rules['sort-exports'], {
    valid: [
        "export * from './c';\nexport { a } from './a';\nexport { bb } from './bb';",
        "export { a } from './a';\n\nexport {\n    long,\n    longer,\n} from './multi';",
        "export { a } from './a';",
        'const a = 1; const bb = 2; export { a, bb };',
        'export { a, bb, ccc } from "./x";',
        'export { a, type Bb } from "./x";',
        'export function one() { return 1; }\nexport const a = 1;',
        "export { a } from './a';\nconst value = 1;\nexport { value };",
    ],
    invalid: [
        {
            code: "export { ccc } from './ccc';\nexport { a } from './a';",
            output: "export { a } from './a';\nexport { ccc } from './ccc';",
            errors: [{ messageId: 'layout' }],
        },
        {
            code: "export {\n    long,\n    longer,\n} from './multi';\nexport { a } from './a';",
            output: "export { a } from './a';\n\nexport {\n    long,\n    longer,\n} from './multi';",
            errors: [{ messageId: 'layout' }],
        },
        {
            code: "export * from './bbb';\nexport * from './a';",
            output: "export * from './a';\nexport * from './bbb';",
            errors: [{ messageId: 'layout' }],
        },
        {
            code: 'export { bb, a } from "./x";',
            output: 'export { a, bb } from "./x";',
            errors: [{ messageId: 'names' }],
        },
        {
            code: 'const a = 1; const bb = 2; export { bb, a };',
            output: 'const a = 1; const bb = 2; export { a, bb };',
            errors: [{ messageId: 'names' }],
        },
        {
            code: 'export {\n    longer,\n    a,\n    bb,\n} from "./x";',
            output: 'export {\n    a,\n    bb,\n    longer,\n} from "./x";',
            errors: [{ messageId: 'names' }],
        },
    ],
});
