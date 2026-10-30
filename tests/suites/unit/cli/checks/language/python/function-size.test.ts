import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { FUNCTION_SIZE_SOURCE } from '#tests/config/checks/language/python.ts';

test('a Python function over limits.python.function_lines is reported, counting code lines only', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: '[limits.python]\nfunction_lines = 3\n',
        }),
        'main.py': FUNCTION_SIZE_SOURCE,
    });
    const findings = await runSandboxCheck(sandbox.path, 'python/function-size');
    expect(findings.map(({ line, rule, message }) => ({ line, rule, message }))).toStrictEqual([
        { line: 7, rule: 'function-lines', message: 'long has 4 code lines, over the limit of 3.' },
    ]);
});

test('Python function size excludes a multiline docstring and keeps comment-like string lines', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: '[limits.python]\nfunction_lines = 3\n',
        }),
        'main.py':
            'def short():\n    """Describe the operation.\n\n    This is documentation.\n    """\n    return 1\n\ndef long():\n    text = """first\n# this is string content\nlast"""\n    return text\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'python/function-size')).toMatchObject([
        { file: 'main.py', line: 8, rule: 'function-lines', message: 'long has 5 code lines, over the limit of 3.' },
    ]);
});
