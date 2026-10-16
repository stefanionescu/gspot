import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { PYPROJECT } from '#tests/config/python/project.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { pydoclint } from '#cli/checks/language/python/pydoclint.ts';

import {
    NUMPY_DOCSTRING_MODULE,
    PYDOCLINT_PROJECT_CASES,
    GOOGLE_DOCSTRING_MODULE,
} from '#tests/config/python/docstrings.ts';

test.each(PYDOCLINT_PROJECT_CASES)('pydoclint $name', async ({ project, setting, expected, command }) => {
    await using sandbox = await testdir();
    const executable = buildVenvExecutablePath('.gspot/.venv', 'pydoclint');
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['python'], {
            tables: setting === undefined ? '' : `[tools.ruff]\ndocstring_convention = "${setting}"\n`,
        }),
        'pyproject.toml': project,
        'source.py': 'value = 1\n',
        [executable]: '',
    });
    await chmod(join(sandbox.path, executable), 0o755);
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'all', only: ['python/pydoclint'] });
    using _version = spyOn(processes, 'spawnProcessBlocking').mockReturnValue(
        processResult({
            stdout: `pydoclint, version ${session.manifests.get('python')!.tools.find((tool) => tool.name === 'pydoclint')!.version!}\n`,
        }),
    );
    using run = spyOn(processes, 'run').mockResolvedValue(processResult());
    const result = await pydoclint(session, planned!);
    expect(result.status).toBe('passed');
    expect(run.mock.calls[0]?.[0].slice(1)).toStrictEqual([
        ...command.slice(1).map((part) => (part === '{files}' ? 'source.py' : part)),
        '--style',
        expected,
    ]);
});

test('pydoclint keeps earlier style findings when a later style batch fails', async () => {
    await using sandbox = await testdir();
    const executable = buildVenvExecutablePath('.gspot/.venv', 'pydoclint');
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['python']),
        'pyproject.toml': PYPROJECT,
        'google.py': GOOGLE_DOCSTRING_MODULE,
        'numpy.py': NUMPY_DOCSTRING_MODULE,
        [executable]: '',
    });
    await chmod(join(sandbox.path, executable), 0o755);
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'all', only: ['python/pydoclint'] });
    using _version = spyOn(processes, 'spawnProcessBlocking').mockReturnValue(
        processResult({
            stdout: `pydoclint, version ${session.manifests.get('python')!.tools.find((tool) => tool.name === 'pydoclint')!.version!}\n`,
        }),
    );
    using command = spyOn(processes, 'run')
        .mockResolvedValueOnce(
            processResult({
                code: 1,
                stdout: 'google.py\n    1: DOC103: The documented argument is wrong.\n',
                duration: 2,
            }),
        )
        .mockResolvedValueOnce(
            processResult({
                code: 2,
                stderr: 'The native command could not read its configuration.',
                isErrored: true,
                duration: 3,
            }),
        );
    const result = await pydoclint(session, planned!);
    expect(result.status).toBe('error');
    expect(result.fileCount).toBe(2);
    expect(result.findings).toMatchObject([{ file: 'google.py', rule: 'DOC103' }]);
    expect(result.note).toContain('The native command could not read its configuration.');
    expect(command.mock.calls.map(([argv]) => argv[argv.indexOf('--style') + 1])).toStrictEqual(['google', 'numpy']);
});
