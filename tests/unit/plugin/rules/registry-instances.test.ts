import { tester } from '#tests/harness/plugin/tester.ts';
import { registryInstances } from '#plugin/rules/registry-instances.ts';

tester().run('registry-instances', registryInstances, {
    valid: [
        { code: 'export const client = new Client();', filename: '/repo/src/turn/registry.ts' },
        { code: 'export const client = make();', filename: '/repo/src/turn/client.ts' },
        { code: 'const client = new Client();', filename: '/repo/src/turn/client.ts' },
        {
            code: 'export const store = new Store();',
            filename: '/repo/src/store.ts',
            options: [{ registryFiles: ['**/store.ts'] }],
        },
    ],
    invalid: [
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
    ],
});
