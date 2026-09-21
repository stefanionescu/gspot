import { expect, test } from 'bun:test';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';

test.each([
    { scenario: 'pass', status: 'ok', checked: 1 },
    { scenario: 'finding', status: 'fail', checked: 1 },
    { scenario: 'skip', status: 'skipped', checked: 0 },
    { scenario: 'ignore', status: 'skipped', checked: 0 },
    { scenario: 'missing', status: 'missing', checked: 0 },
])('coverage counts executed source checks for $scenario', async ({ scenario, status, checked }) => {
    await using sandbox = await testdir();
    const check = 'project/syntax';
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            presets: [],
            ...(scenario === 'ignore' ? { ignore: [{ check }] } : {}),
            check: [
                {
                    name: check,
                    command:
                        scenario === 'missing'
                            ? ['gspot-missing-coverage-executable', '{files}']
                            : ['bash', '-n', '{files}'],
                    paths: ['source.sh'],
                    stage: 'commit',
                },
            ],
        }),
        'source.sh': scenario === 'finding' ? 'if then\n' : 'echo example\n',
    });
    const outcome = await executeRun(await openSession(sandbox.path), {
        stage: 'all',
        skips: scenario === 'skip' ? [check] : [],
        fix: false,
        isDryRun: true,
        noCache: true,
    });
    expect(outcome.report.checks).toMatchObject([{ check, status }]);
    expect(outcome.report.coverage).toEqual({ checked, unchecked: 2 - checked });
});
