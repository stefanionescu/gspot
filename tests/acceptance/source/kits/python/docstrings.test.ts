import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { containing } from '#tests/support/expectations.ts';
import { installAtLevel } from '#tests/support/cli/tools.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

import {
    TOOLS_CLEAN,
    TOOLS_MODULE,
    STRUCTURE_INIT,
    NUMPY_DOCSTRING,
    STRUCTURE_PROJECT,
} from '#tests/inputs/acceptance/source/kits/python.ts';

test.each([
    ['Google from Ruff', '[tool.ruff.lint.pydocstyle]\nconvention = "google"\n', TOOLS_CLEAN],
    ['NumPy from Ruff', '[tool.ruff.lint.pydocstyle]\nconvention = "numpy"\n', NUMPY_DOCSTRING],
    [
        'explicit Google',
        '[tool.ruff.lint.pydocstyle]\nconvention = "numpy"\n[tool.pydoclint]\nstyle = "google"\n',
        TOOLS_CLEAN,
    ],
    ['native NumPy default', '', NUMPY_DOCSTRING],
])(
    '%s preserves native docstring findings',
    async (_name, configuration, clean) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'pyproject.toml': `${STRUCTURE_PROJECT}\n${configuration}`,
            [TOOLS_MODULE]: clean.replace(/ {4}value (?=[:(])/u, '    amount '),
        });
        commitAll(sandbox.path);
        await installAtLevel(sandbox.path, STRUCTURE_INIT, {});
        const command = ['check', '--only', 'python/pydoclint', '--no-cache', '--json'];
        const rejected = await run(sandbox.path, command);
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        const report = JSON.parse(rejected.stdout) as RunReport;
        expect(report.checks).toMatchObject([{ check: 'python/pydoclint', status: 'fail' }]);
        expect(report.checks[0]!.findings).toContainEqual(containing({ file: TOOLS_MODULE, rule: 'DOC103', line: 4 }));
        await Bun.write(join(sandbox.path, TOOLS_MODULE), clean);
        const corrected = await run(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'python/pydoclint', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 6,
);
