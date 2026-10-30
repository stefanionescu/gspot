import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { LONG_PYTHON_FILE, LONG_JAVASCRIPT_FILE } from '#tests/config/checks/general/structure/structure.ts';

test.each(['.sh', '.bats', ''])('Bash %s heredocs and multiline strings count as code lines', async (extension) => {
    const source = '#!/bin/sh\n# comment\ncat <<\'EOF\'\n# literal\nEOF\nvalue="first\n# literal\nlast"\n';
    const file = `run${extension}`;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all', tables: '[limits.bash]\nfile_lines = 5\n' }),
        [file]: source,
    });
    const found = await runSandboxCheck(sandbox.path, 'structure/long-files');
    expect(found).toStrictEqual([
        {
            check: 'structure/long-files',
            file,
            line: 1,
            rule: 'file-lines',
            fixable: false,
            message: 'This file has 6 code lines, over the limit of 5.',
            help: 'Split the file by responsibility, or raise `limits.<language>.file_lines` with a reason.',
        },
    ]);
    await writeFile(join(sandbox.path, file), source.replace('# literal\nEOF', 'EOF'));
    expect(await runSandboxCheck(sandbox.path, 'structure/long-files')).toStrictEqual([]);
});

test('long files checks authored covered languages and leaves generated, vendored, and ESLint-owned files out', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python', 'javascript'], {
            level: 'all',
            tables: '[limits]\nfile_lines = 2\n',
        }),
        'source.py': LONG_PYTHON_FILE,
        '.gspot/configurations/language/javascript/eslint/eslint.mjs': LONG_JAVASCRIPT_FILE,
        '.gspot/generated.py': LONG_PYTHON_FILE,
        'vendor/copied.py': LONG_PYTHON_FILE,
        'source.js': LONG_JAVASCRIPT_FILE,
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/long-files');
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        { file: 'source.py', rule: 'file-lines', message: 'This file has 13 code lines, over the limit of 2.' },
    ]);
});

test('SQL strings count while multiline SQL comments do not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['sql'], { level: 'all', tables: '[limits.sql]\nfile_lines = 2\n' }),
        'query.sql': '/* This comment\nspans two lines. */\nSELECT $$first\n-- string content\nlast$$;\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/long-files')).toMatchObject([
        { file: 'query.sql', rule: 'file-lines', message: 'This file has 3 code lines, over the limit of 2.' },
    ]);
});

test('a Python string line that starts with # counts as code', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all', tables: '[limits.python]\nfile_lines = 2\n' }),
        'source.py': 'value = """first\n# string content\nlast"""\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/long-files');
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        { file: 'source.py', rule: 'file-lines', message: 'This file has 3 code lines, over the limit of 2.' },
    ]);
    await writeFile(join(sandbox.path, 'source.py'), 'value = """first\nlast"""\n# a comment\n');
    expect(await runSandboxCheck(sandbox.path, 'structure/long-files')).toStrictEqual([]);
});
