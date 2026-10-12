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
import { virtualEnvironmentExecutable } from '#cli/system/executables.ts';
import { pydoclint, docstringConfiguration } from '#cli/checks/language/python/pydoclint.ts';

import {
    DOCSTRING_STYLES,
    NUMPY_DOCSTRING_MODULE,
    GOOGLE_DOCSTRING_MODULE,
    DEFAULT_PYDOCLINT_COMMAND,
} from '#tests/config/python/docstrings.ts';

test.each([...DOCSTRING_STYLES])('the docstring convention $name', ({ project, setting, expected }) => {
    expect(docstringConfiguration(project, setting).style).toBe(expected);
});

test.each(['', '[tool.ruff]\nline-length = 88\n', '[tool.ruff.lint.pydocstyle]\nconvention = "pep257"\n'])(
    "no Ruff docstring convention, or an unsupported one, leaves pydoclint's default style: %j",
    (text) => {
        expect(docstringConfiguration(text).style).toBeUndefined();
    },
);

test('pydoclint turns off repeated signature types only when the project has not set those options', () => {
    expect(docstringConfiguration('').command).toStrictEqual([...DEFAULT_PYDOCLINT_COMMAND]);
    expect(
        docstringConfiguration(
            '[tool.pydoclint]\narg-type-hints-in-docstring = true\ncheck_return_types = false\ncheck-yield-types = true\n',
        ).command,
    ).toStrictEqual(['pydoclint', '--allow-init-docstring', 'true', '--quiet', '{files}']);
});

test('pydoclint keeps earlier style findings when a later style batch fails', async () => {
    await using sandbox = await testdir();
    const executable = virtualEnvironmentExecutable('.gspot/.venv', 'pydoclint');
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
    using _version = spyOn(processes, 'runBlocking').mockReturnValue(
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
