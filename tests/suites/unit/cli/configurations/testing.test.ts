import { realpathSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { selectCheckCode } from '#cli/configurations/registry.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { buildCheckSession, runCheckCode } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { CHECK_GENERATION, CHECK_RUN_OPTIONS } from '#tests/setup/cli/run.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('vitest/tests leaves a nested scope with its own config out of the coverage report and by each pattern form', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml':
            'configurations = ["vitest"]\n\n[[scope]]\npath = "a"\nconfigurations = ["vitest"]\n\n[[scope]]\npath = "a/b"\nconfigurations = ["vitest"]\n',
        'a/vitest.config.mjs': '',
        'a/a.test.js': '',
        'a/b/vitest.config.mjs': '',
        'a/b/b.test.js': '',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { only: ['vitest/tests'], stage: 'push' }).find(
        ({ scope }) => scope.path === 'a',
    )!;
    planned.tool = { name: process.execPath, kind: 'program', installers: {} };
    using _spawn = fakeCommands(process.execPath, () => Promise.resolve(buildProcessResult()));
    const code = selectCheckCode(planned.check);
    const result = await runCheckCode(buildCheckSession(session, CHECK_GENERATION), planned, code, CHECK_RUN_OPTIONS);
    expect(result.status, result.note).toBe('passed');
    const nested = convertToPosixPath(join(realpathSync(sandbox.path), 'a/b'));
    expect(result.command?.slice(-5)).toStrictEqual([
        '--exclude',
        'b/**',
        '--exclude',
        `${nested}/**`,
        '--coverage.all=false',
    ]);
});
