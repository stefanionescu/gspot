import { tester } from '#tests/harness/plugin/tester.ts';
import { envOwner as environmentAccessOwner } from '#plugin/rules/env-owner.ts';

const OWNERS: [{ owners: string[] }] = [{ owners: ['src/env/**', 'config/**'] }];

tester().run('env-owner', environmentAccessOwner, {
    valid: [
        ...['process', 'Bun', 'Deno'].map((host) => ({
            code: `function read(${host}) { return ${host}.env.KEY; }`,
            filename: '/repo/src/turn/build.ts',
            options: OWNERS,
        })),
        { code: 'const port = process.env.PORT;', filename: '/repo/src/env/index.ts', options: OWNERS },
        { code: 'const port = process.env.PORT;', filename: '/repo/config/env.ts', options: OWNERS },
        { code: 'const mode = process.env.NODE_ENV;', filename: '/repo/src/turn/build.ts', options: OWNERS },
        { code: 'const port = env.PORT;', filename: '/repo/src/turn/build.ts', options: OWNERS },
        // With no owners named, the rule has no place to send a read, so it reports nothing.
        { code: 'const port = process.env.PORT;', filename: '/repo/src/turn/build.ts' },
    ],
    invalid: [
        ...[
            'const port = process.env.PORT;',
            'const all = process.env;',
            'const url = import.meta.env.VITE_URL;',
            'const key = Bun.env.KEY;',
            "const key = Deno.env.get('KEY');",
        ].map((code) => ({
            code,
            filename: '/repo/src/turn/build.ts',
            options: OWNERS,
            errors: [{ messageId: 'owner' as const }],
        })),
    ],
});
