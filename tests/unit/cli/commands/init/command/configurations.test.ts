import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { openSession } from '#cli/commands/session.ts';
import { CONFIGURATION_CHOICES } from '#tests/config/init.ts';
import { ALWAYS_SELECTED } from '#tests/config/configurations.ts';

test.each([...CONFIGURATION_CHOICES])(
    'init with --configurations %j keeps the always-selected configurations',
    async ({ configurations }) => {
        await using sandbox = await testdir({
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            'source.js': 'export const port = 8080;\n',
        });
        commitAll(sandbox.path);
        const initialized = await runGspot(sandbox.path, [
            'init',
            '--yes',
            ...(configurations === undefined || configurations.length === 0
                ? []
                : ['--configurations', ...configurations]),
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        const selected = session.scopes[0]!.selected.map((manifest) => manifest.configuration.name);
        for (const configuration of ALWAYS_SELECTED) expect(selected).toContain(configuration);
    },
);
