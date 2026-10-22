import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('a Python function over limits.python.function_lines is reported, counting code lines only', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: '[limits.python]\nfunction_lines = 3\n',
        }),
        'main.py':
            'def short():\n    # A comment.\n\n    return 1\n\n\ndef long(value):\n    first = value\n    second = first\n    return second\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'python/function-size');
    expect(findings.map(({ line, rule, message }) => ({ line, rule, message }))).toStrictEqual([
        { line: 7, rule: 'function-lines', message: 'long has 4 code lines, over the limit of 3.' },
    ]);
});
