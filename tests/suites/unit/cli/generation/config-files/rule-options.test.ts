import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { INACTIVE_RULE_OPTIONS } from '#tests/config/generation/config-files/rule-options.ts';

test.each([...INACTIVE_RULE_OPTIONS])(
    'inactive $configuration rule $rule refuses options',
    async ({ configuration, tables, message }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([configuration], { level: 'all', tables }),
            'source.js': 'export const total = 1;\n',
        });
        const error = await captureRejection(openSession(sandbox.path).then((session) => buildGeneratedFiles(session)));
        expect(error.message).toBe(message);
    },
);
