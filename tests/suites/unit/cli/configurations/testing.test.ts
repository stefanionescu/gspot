import { realpathSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { selectCheckCode } from '#cli/configurations/registry.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { buildCheckSession, runCheckCode } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#cli/generation/checks.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('vitest/tests leaves a nested scope with its own config out of the coverage report and by each pattern form, and a scope with none runs as declared', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml':
            'configurations = ["vitest"]\n\n[[scope]]\npath = "a"\nconfigurations = ["vitest"]\n\n[[scope]]\npath = "a/b"\nconfigurations = ["vitest"]\n',
        'a/vitest.config.mjs': '',
        'a/a.test.js': '',
        'a/b/vitest.config.mjs': '',
        'a/b/b.test.js': '',
    });
    const session = await openSession(sandbox.path);
    using _spawn = fakeCommands(process.execPath, () => Promise.resolve(buildProcessResult()));
    const runScope = async (scopePath: string) => {
        const planned = planChecks(session, { only: ['vitest/tests'], stage: 'push' }).find(
            ({ scope }) => scope.path === scopePath,
        )!;
        planned.tool = { name: process.execPath, kind: 'program', installers: {} };
        const code = selectCheckCode(planned.check);
        return await runCheckCode(buildCheckSession(session, CHECK_GENERATION), planned, code, {});
    };
    const nested = convertToPosixPath(join(realpathSync(sandbox.path), 'a/b'));
    const parent = await runScope('a');
    const leaf = await runScope('a/b');
    expect(parent.command?.slice(-5)).toStrictEqual([
        '--exclude',
        'b/**',
        '--exclude',
        `${nested}/**`,
        '--coverage.all=false',
    ]);
    expect(leaf.command?.slice(-3)).toStrictEqual(['--passWithNoTests', '--exclude', '**/.gspot-copies/**']);
});
