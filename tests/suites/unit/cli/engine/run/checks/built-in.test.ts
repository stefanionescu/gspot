import { expect, test } from 'bun:test';

import { buildCheckSession, runBuiltInCheck } from '#cli/engine/run/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#cli/generation/stale.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('the built-in dispatcher attaches the check ID and fixability to sparse findings, and keeps the help of a finding', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['naming'], { level: 'all' }),
        'source.js': 'export const source = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'naming/identifiers');
    const result = await runBuiltInCheck(
        () => [
            { file: 'source.js', rule: 'name', message: 'Choose a descriptive name.' },
            { file: 'source.js', rule: 'name', message: 'Choose another name.', help: 'Use the project vocabulary.' },
        ],
        buildCheckSession(session, CHECK_GENERATION),
        planned,
        {},
    );
    expect(result.status).toBe('failed');
    expect(result.findings).toStrictEqual([
        {
            check: 'naming/identifiers',
            fixable: false,
            file: 'source.js',
            rule: 'name',
            message: 'Choose a descriptive name.',
        },
        {
            check: 'naming/identifiers',
            fixable: false,
            file: 'source.js',
            rule: 'name',
            message: 'Choose another name.',
            help: 'Use the project vocabulary.',
        },
    ]);
});
