import { createRuleTester } from '#tests/harness/rule-tester.ts';
import { instancesInRegistry } from '#plugin/rules/instances-in-registry.ts';
import type { InstancesInRegistryOptions } from '#plugin/types/instances-in-registry.ts';

createRuleTester().run<keyof typeof instancesInRegistry.meta.messages, [Partial<InstancesInRegistryOptions[0]>]>(
    'instances-in-registry',
    instancesInRegistry,
    {
        valid: [
            {
                code: 'export const values = new Set();',
                filename: '/repo/src/values.ts',
                options: [{ files: ['**/registry.*'] }],
            },
            {
                code: 'export const values = new Map<string, number>();',
                filename: '/repo/src/values.ts',
                options: [{ files: ['**/registry.*'] }],
            },
            {
                code: 'export const expression = new RegExp("pattern");',
                filename: '/repo/src/expression.ts',
                options: [{ files: ['**/registry.*'] }],
            },
            {
                code: 'export const client = new Client();',
                filename: '/repo/src/registry.tsx',
                options: [{ files: ['**/registry.*'] }],
            },
            {
                code: 'export const client = new Client();',
                filename: '/repo/src/registry.mjs',
                options: [{ files: ['**/registry.*'] }],
            },
            {
                code: 'export const client = new Client();',
                filename: '/repo/src/turn/registry.ts',
                options: [{ files: ['**/registry.*'] }],
            },
            { code: 'export const client = new Client();', filename: '/repo/src/turn/client.ts' },
            {
                code: 'export const client = make();',
                filename: '/repo/src/turn/client.ts',
                options: [{ files: ['**/registry.*'] }],
            },
            {
                code: 'const client = new Client();',
                filename: '/repo/src/turn/client.ts',
                options: [{ files: ['**/registry.*'] }],
            },
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
                options: [{ files: ['**/registry.*'] }],
                errors: [{ messageId: 'registry' }],
            },
            {
                code: 'export const client = new Client();',
                filename: '/repo/src/turn/client.ts',
                options: [{ files: ['**/registry.*'] }],
                errors: [{ messageId: 'registry' }],
            },
            {
                code: 'export default new Client();',
                filename: '/repo/src/turn/client.ts',
                options: [{ files: ['**/registry.*'] }],
                errors: [{ messageId: 'registry' }],
            },
            {
                code: 'export const client = new Client() as Client;',
                filename: '/repo/src/turn/client.ts',
                options: [{ files: ['**/registry.*'] }],
                errors: [{ messageId: 'registry' }],
            },
            {
                code: 'export const client = <Client>new Client();',
                filename: '/repo/src/client.ts',
                options: [{ files: ['**/registry.*'] }],
                errors: [{ messageId: 'registry' }],
            },
        ],
    },
);
