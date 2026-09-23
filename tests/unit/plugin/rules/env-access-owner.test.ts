import { tester } from '#tests/support/plugin/tester.ts';
import { envAccessOwner as environmentAccessOwner } from '#plugin/rules/env-access-owner.ts';

tester().run('env-access-owner', environmentAccessOwner, {
    valid: [
        ...['process', 'Bun', 'Deno'].map((host) => ({
            code: `function read(${host}) { return ${host}.env.KEY; }`,
            filename: '/repo/src/turn/build.ts',
        })),
        { code: 'const port = process.env.PORT;', filename: '/repo/src/env/index.ts' },
        { code: 'const port = process.env.PORT;', filename: '/repo/config/env.ts' },
        { code: 'const mode = process.env.NODE_ENV;', filename: '/repo/src/turn/build.ts' },
        { code: 'const port = env.PORT;', filename: '/repo/src/turn/build.ts' },
        {
            code: 'const port = process.env.PORT;',
            filename: '/repo/src/turn/build.ts',
            options: [{ owners: ['src/turn/**'] }],
        },
    ],
    invalid: [
        {
            code: 'const port = process.env.PORT;',
            filename: '/repo/src/turn/build.ts',
            errors: [{ messageId: 'owner' }],
        },
        { code: 'const all = process.env;', filename: '/repo/src/turn/build.ts', errors: [{ messageId: 'owner' }] },
        {
            code: 'const url = import.meta.env.VITE_URL;',
            filename: '/repo/src/turn/build.ts',
            errors: [{ messageId: 'owner' }],
        },
        { code: 'const key = Bun.env.KEY;', filename: '/repo/src/turn/build.ts', errors: [{ messageId: 'owner' }] },
        {
            code: "const key = Deno.env.get('KEY');",
            filename: '/repo/src/turn/build.ts',
            errors: [{ messageId: 'owner' }],
        },
    ],
});
