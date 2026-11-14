import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { openSession } from '#cli/engine/session.ts';
import { planChecks } from '#cli/engine/plan/checks.ts';
import { selectCheckCommand } from '#cli/engine/plan/coverage.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const TWO_WORDS = 'two words';

test('coverage stripping leaves your own checks and given arguments unchanged', async () => {
    const command = [process.execPath, '--coverage', '', TWO_WORDS];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [{ id: 'project/tests', command, stage: 'push', paths: ['sample.test.cjs'] }],
            }),
        }),
        'sample.test.cjs': 'const authored = true;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'push', only: ['project/tests'] })[0]!;
    expect(selectCheckCommand(planned, {})).toStrictEqual(command);
    expect(selectCheckCommand(planned, { command: ['echo', '', TWO_WORDS] })).toStrictEqual(['echo', '', TWO_WORDS]);
});

test('a shared function coverage limit enables Jest coverage without enabling pytest coverage', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python', 'pytest', 'jest'], {
            tables: '[coverage]\nmin_line_percent = 0\nmin_function_percent = 100\n',
        }),
        'test_math.py': 'def test_math():\n    assert 1 + 1 == 2\n',
        'math.test.js': 'test("sum", () => expect(1 + 1).toBe(2));\n',
    });
    const plans = planChecks(await openSession(sandbox.path), {
        stage: 'push',
        only: ['pytest/tests', 'jest/tests'],
    });
    const jestPlan = plans.find(({ check }) => check.id === 'jest/tests')!;
    const pytestPlan = plans.find(({ check }) => check.id === 'pytest/tests')!;
    expect(selectCheckCommand(jestPlan, {})).toContain('--coverage');
    expect(selectCheckCommand(pytestPlan, {})).not.toContain('--cov');
});
