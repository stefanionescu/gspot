import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { LONG_PYTHON_FILE } from '#tests/config/python/modules.ts';
import { fileLines } from '#cli/checks/general/structure/file-lines.ts';

test.each(['.sh', '.bats', ''])('Bash %s heredocs and multiline strings count as code lines', async (extension) => {
    const source = '#!/bin/sh\n# comment\ncat <<\'EOF\'\n# literal\nEOF\nvalue="first\n# literal\nlast"\n';
    const file = `run${extension}`;
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['bash'], { level: 'all', tables: '[limits.bash]\nfile_lines = 5\n' }),
        [file]: source,
    });
    const found = await fileLines(buildCheckInput(await openSession(sandbox.path), 'structure/file-lines'));
    expect(found).toMatchObject([
        { file, line: 1, rule: 'file-lines', message: 'This file has 6 code lines, over the limit of 5.' },
    ]);
    await Bun.write(join(sandbox.path, file), source.replace('# literal\nEOF', 'EOF'));
    expect(await fileLines(buildCheckInput(await openSession(sandbox.path), 'structure/file-lines'))).toStrictEqual([]);
});

test('Python files count each executable line against the declared limit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], { level: 'all', tables: '[limits]\nfile_lines = 12\n' }),
        'example/big.py': `"""A test module."""\n\n\n${LONG_PYTHON_FILE}\n`,
    });
    expect(await fileLines(buildCheckInput(await openSession(sandbox.path), 'structure/file-lines'))).toMatchObject([
        { file: 'example/big.py', rule: 'file-lines', line: 1 },
    ]);
});
