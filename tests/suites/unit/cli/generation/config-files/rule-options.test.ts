import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { INACTIVE_RULE_OPTIONS } from '#tests/config/generation/config-files/rule-options.ts';

test.each([...INACTIVE_RULE_OPTIONS])(
    'inactive $configuration rule $rule refuses options',
    async ({ configuration, tables, scoped, message }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([configuration], {
                level: 'all',
                tables,
                scopes: scoped ? [{ path: 'web' }] : [],
            }),
            'source.js': 'export const total = 1;\n',
            'web/README.md': '# Web\n',
        });
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
        const error = await captureRejection((async () => generate(await openSession(sandbox.path)))());
        expect(error.message).toBe(message);
    },
);
