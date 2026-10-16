import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { type CheckInput } from '#cli/types/execution/check.ts';
import { MARKDOWN_FENCE_CASES } from '#tests/config/markdown.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';

test.each([...MARKDOWN_FENCE_CASES])(
    'markdown/fences reports each fence that does not parse: $name',
    async ({ markdown, lines }) => {
        await using sandbox = await testdir({
            'gspot.toml': settingsText(['markdown'], { level: 'all' }),
            'example.md': markdown,
        });
        const found = await checkFindings(sandbox.path, 'markdown/fences', { paths: ['example.md'] });
        expect(found.map(({ line, rule }) => [line, rule])).toStrictEqual(lines.map((line) => [line, 'syntax']));
    },
);

test('markdown/fences reports a Bash syntax error in a fence, passes after the fix, and stops on cancel', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['markdown'], { level: 'all' }),
        'a.md': '```bash\nif then\n```\n',
    });
    let selected: CheckInput = buildCheckInput(await openSession(sandbox.path), 'markdown/fences', {
        paths: ['a.md'],
    });
    const found = await CHECK_IMPLEMENTATIONS['markdown/fences'].check(selected);
    expect(found).toMatchObject([{ check: 'markdown/fences', file: 'a.md', line: 2, rule: 'syntax', fixable: false }]);
    expect(found[0]!.message).toContain('Syntax error');
    await writeFile(join(sandbox.path, 'a.md'), '```bash\nprintf "%s\\n" "Hello"\n```\n');
    selected = buildCheckInput(await openSession(sandbox.path), 'markdown/fences', { paths: ['a.md'] });
    expect(await CHECK_IMPLEMENTATIONS['markdown/fences'].check(selected)).toStrictEqual([]);
    const cancelled = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['markdown/fences'], cancelSignal: AbortSignal.abort() }),
    );
    expect(cancelled.report.checks).toMatchObject([{ status: 'error', note: 'The check was canceled.' }]);
});
