import { createRuleTester } from '#tests/harness/rule-tester.ts';
import { instancesInRegistry } from '#plugin/rules/instances-in-registry.ts';

createRuleTester().run('instances-in-registry', instancesInRegistry, {
    valid: [
        { code: 'export const values = new Set();', filename: '/repo/src/values.ts' },
        { code: 'export const values = new Map<string, number>();', filename: '/repo/src/values.ts' },
        { code: 'export const expression = new RegExp("pattern");', filename: '/repo/src/expression.ts' },
        { code: 'export const client = new Client();', filename: '/repo/src/registry.tsx' },
        { code: 'export const client = new Client();', filename: '/repo/src/registry.mjs' },
        { code: 'export const client = new Client();', filename: '/repo/src/turn/registry.ts' },
        { code: 'export const client = make();', filename: '/repo/src/turn/client.ts' },
        { code: 'const client = new Client();', filename: '/repo/src/turn/client.ts' },
        {
            code: 'export const store = new Store();',
            filename: '/repo/src/store.ts',
            options: [{ files: ['**/store.ts'] }],
        },
    ],
    invalid: [
        {
            code: 'class Set {} export const client = new Set();',
            filename: '/repo/src/client.ts',
            errors: [{ messageId: 'registry' }],
        },
        {
            code: 'export const client = new Client();',
            filename: '/repo/src/turn/client.ts',
            errors: [{ messageId: 'registry' }],
        },
        {
            code: 'export default new Client();',
            filename: '/repo/src/turn/client.ts',
            errors: [{ messageId: 'registry' }],
        },
        {
            code: 'export const client = new Client() as Client;',
            filename: '/repo/src/turn/client.ts',
            errors: [{ messageId: 'registry' }],
        },
        {
            code: 'export const client = <Client>new Client();',
            filename: '/repo/src/client.ts',
            errors: [{ messageId: 'registry' }],
        },
    ],
});
