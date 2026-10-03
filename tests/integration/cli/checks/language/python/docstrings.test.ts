import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import * as toolRunner from '#cli/execution/tool/runner.ts';
import { STRUCTURE_PROJECT } from '#tests/samples/python.ts';
import { pydoclint } from '#cli/checks/language/python/pydoclint.ts';
import { PYDOCLINT_COMMAND } from '#cli/config/checks/language/python.ts';

test.each([
    ['the Google convention of Ruff', '[tool.ruff.lint.pydocstyle]\nconvention = "google"\n', ['--style', 'google']],
    ['the NumPy convention of Ruff', '[tool.ruff.lint.pydocstyle]\nconvention = "numpy"\n', ['--style', 'numpy']],
    [
        'no style when pydoclint names its own',
        '[tool.ruff.lint.pydocstyle]\nconvention = "numpy"\n[tool.pydoclint]\nstyle = "google"\n',
        [],
    ],
    ['no style when nothing names one', '', []],
])('pydoclint runs with %s', async (_name, configuration, style) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['python']),
        'pyproject.toml': `${STRUCTURE_PROJECT}\n${configuration}`,
        'planted/__init__.py': '"""Planted."""\n',
    });
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'all', skips: [], only: ['python/pydoclint'] });
    const command = spyOn(toolRunner, 'runToolCheck').mockImplementation((_session, check, argv) =>
        Promise.resolve({
            check: check.spec.name,
            scope: check.scope.scope.path,
            status: 'passed',
            fileCount: 0,
            duration: 0,
            findings: [],
            ...(argv === undefined ? {} : { command: argv }),
        }),
    );
    try {
        const result = await pydoclint(session, planned!);
        expect(result.command).toStrictEqual([...PYDOCLINT_COMMAND, ...style]);
    } finally {
        command.mockRestore();
    }
});
