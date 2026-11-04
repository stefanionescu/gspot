import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { FUNCTION_SIZE_SOURCE } from '#tests/config/configurations/python.ts';

test('a Python function over limits.python.max_function_lines is reported, counting code lines only', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: '[limits.python]\nmax_function_lines = 3\n',
        }),
        'main.py': FUNCTION_SIZE_SOURCE,
    });
    const findings = await runSandboxCheck(sandbox.path, 'python/function-size');
    expect(findings.map(({ line, rule, message }) => ({ line, rule, message }))).toStrictEqual([
        { line: 7, rule: 'function-lines', message: expect.stringMatching(/\blong\b.+\b4\b.+\b3\b/u) as string },
    ]);
});

test('Python function size excludes a multiline docstring and keeps comment-like string lines', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: '[limits.python]\nmax_function_lines = 3\n',
        }),
        'main.py':
            'def short():\n    """Describe the operation.\n\n    This is documentation.\n    """\n    return 1\n\ndef long():\n    text = """first\n# this is string content\nlast"""\n    return text\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'python/function-size')).toMatchObject([
        {
            file: 'main.py',
            line: 8,
            rule: 'function-lines',
            message: expect.stringMatching(/\blong\b.+\b5\b.+\b3\b/u) as string,
        },
    ]);
});
