import { OWNERS } from '#tests/config/cli/plugin-env-owner.ts';
import { createRuleTester } from '#tests/harness/rule-tester.ts';
import { ENVIRONMENT_GLOBALS } from '#tests/config/plugin/environment.ts';
import { envOwner as environmentAccessOwner } from '#plugin/rules/env-owner.ts';

createRuleTester('/repo', { globals: ENVIRONMENT_GLOBALS }).run('env-owner', environmentAccessOwner, {
    valid: [
        ...['process', 'Bun', 'Deno'].map((host) => ({
            code: `function read(${host}) { return ${host}.env.KEY; }`,
            filename: '/repo/src/turn/build.ts',
            options: OWNERS,
        })),
        { code: 'const port = process.env.PORT;', filename: '/repo/src/env/index.ts', options: OWNERS },
        { code: 'const port = process.env.PORT;', filename: '/repo/config/env.ts', options: OWNERS },
        { code: 'const mode = process.env.NODE_ENV;', filename: '/repo/src/turn/build.ts', options: OWNERS },
        { code: 'const { NODE_ENV } = process.env;', filename: '/repo/src/turn/build.ts', options: OWNERS },
        {
            code: 'const mode = process.env.APP_MODE;',
            filename: '/repo/src/turn/build.ts',
            options: [{ ...OWNERS[0], allowed: ['APP_MODE'] }],
        },
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
            'const host = process; const key = host.env.KEY;',
            'const { env: values } = Bun; const key = values.KEY;',
            'const values = process.env; const { KEY } = values;',
        ].map((code) => ({
            code,
            filename: '/repo/src/turn/build.ts',
            options: OWNERS,
            errors: [{ messageId: 'owner' as const }],
        })),
    ],
});
