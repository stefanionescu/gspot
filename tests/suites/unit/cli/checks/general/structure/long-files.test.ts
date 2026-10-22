import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { LONG_PYTHON_FILE } from '#tests/config/checks/general/structure/long-files.ts';

test.each(['.sh', '.bats', ''])('Bash %s heredocs and multiline strings count as code lines', async (extension) => {
    const source = '#!/bin/sh\n# comment\ncat <<\'EOF\'\n# literal\nEOF\nvalue="first\n# literal\nlast"\n';
    const file = `run${extension}`;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all', tables: '[limits.bash]\nfile_lines = 5\n' }),
        [file]: source,
    });
    const session = await openSession(sandbox.path);
    const found = await findBuiltInCheck('structure/long-files')(
        session,
        planSandboxCheck(session, 'structure/long-files'),
    );
    expect(found).toMatchObject([
        { file, line: 1, rule: 'file-lines', message: 'This file has 6 code lines, over the limit of 5.' },
    ]);
    await writeFile(join(sandbox.path, file), source.replace('# literal\nEOF', 'EOF'));
    const checkedSession = await openSession(sandbox.path);
    expect(
        await findBuiltInCheck('structure/long-files')(
            checkedSession,
            planSandboxCheck(checkedSession, 'structure/long-files'),
        ),
    ).toStrictEqual([]);
});
test('Python files count each executable line against the declared limit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all', tables: '[limits]\nfile_lines = 12\n' }),
        'example/big.py': `"""A test module."""\n\n\n${LONG_PYTHON_FILE}\n`,
    });
    const session = await openSession(sandbox.path);
    expect(
        await findBuiltInCheck('structure/long-files')(session, planSandboxCheck(session, 'structure/long-files')),
    ).toMatchObject([{ file: 'example/big.py', rule: 'file-lines', line: 1 }]);
});
