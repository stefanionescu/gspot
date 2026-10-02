import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { rejects } from 'node:assert/strict';
import { testdir, createFileTree } from 'testdirs';
import type { EngineInput } from '#cli/types/checks.ts';
import { openSession } from '#cli/execution/session.ts';
import { checkInput } from '#tests/support/cli/input.ts';
import { fences } from '#cli/checks/language/markdown.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';

test('a fenced block that does not parse in its language is a finding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': '```json\n{"a": 1}\n```\n\n```json\n{oops\n```\n\n```toml\nkey = \n```\n\n```ts\nconst a: number = 1;\n```\n\n```text\nnot code {\n```\n',
    });
    const found = await fences(await checkInput(sandbox.path, 'markdown/fences', ['a.md']));
    expect(found.map((finding) => [finding.line, finding.rule])).toStrictEqual([
        [5, 'json'],
        [9, 'toml'],
    ]);
});

test('tilde fences and unclosed examples still report invalid code', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': '> ~~~json\n> {oops\n> ~~~~\n\n```json\n{oops\n',
    });
    const found = await fences(await checkInput(sandbox.path, 'markdown/fences', ['a.md']));
    expect(found.map((finding) => [finding.line, finding.rule])).toStrictEqual([
        [1, 'json'],
        [5, 'json'],
    ]);
});

test('Bash examples report syntax errors, accept corrections, and stop on cancellation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([]),
        'a.md': '```bash\nif then\n```\n',
    });
    const session = await openSession(sandbox.path);
    let selected: EngineInput = {
        ...(await checkInput(sandbox.path, 'markdown/fences', ['a.md'])),
        inspections: session.inspections,
        view: session.scopes[0]!.view,
    };
    const found = await fences(selected);
    expect(found).toMatchObject([{ check: 'markdown/fences', file: 'a.md', line: 1, rule: 'bash', fixable: false }]);
    expect(found[0]!.message).toContain('syntax error');
    writeFileSync(join(sandbox.path, 'a.md'), '```bash\nprintf "%s\\n" "Hello"\n```\n');
    selected = await checkInput(sandbox.path, 'markdown/fences', ['a.md']);
    expect(await fences(selected)).toStrictEqual([]);
    selected.cancelSignal = AbortSignal.abort();
    await rejects(fences(selected), { message: 'The command was canceled.' });
});
