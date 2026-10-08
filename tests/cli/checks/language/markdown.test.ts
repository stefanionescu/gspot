import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { fences } from '#cli/checks/language/markdown.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';

test('TSX and JSONC fences use their declared syntax while JSON rejects comments', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'examples.md':
            '```tsx\nexport const panel = <div>Hello</div>;\n```\n\n```jsonc\n{ // accepted comment\n "enabled": true,\n}\n```\n\n```json\n{ // rejected comment\n "enabled": true\n}\n```\n',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['markdown'], { level: 'all' }));
    const found = await fences(
        buildCheckInput(await openSession(sandbox.path), 'markdown/fences', { paths: ['examples.md'] }),
    );
    expect(found).toMatchObject([{ file: 'examples.md', line: 12, rule: 'syntax' }]);
});

test('a fenced block that does not parse in its language is a finding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': '```json\n{"a": 1}\n```\n\n```json\n{oops\n```\n\n```toml\nkey = \n```\n\n```ts\nconst a: number = 1;\n```\n\n```text\nnot code {\n```\n',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['markdown'], { level: 'all' }));
    const found = await fences(
        buildCheckInput(await openSession(sandbox.path), 'markdown/fences', { paths: ['a.md'] }),
    );
    expect(found.map((finding) => [finding.line, finding.rule])).toStrictEqual([
        [6, 'syntax'],
        [10, 'syntax'],
    ]);
});

test('tilde fences and unclosed examples still report invalid code', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': '> ~~~json\n> {oops\n> ~~~~\n\n```json\n{oops\n',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['markdown'], { level: 'all' }));
    const found = await fences(
        buildCheckInput(await openSession(sandbox.path), 'markdown/fences', { paths: ['a.md'] }),
    );
    expect(found.map((finding) => [finding.line, finding.rule])).toStrictEqual([
        [2, 'syntax'],
        [6, 'syntax'],
    ]);
});

test('Bash examples report syntax errors, accept corrections, and stop on cancellation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['markdown'], { level: 'all' }),
        'a.md': '```bash\nif then\n```\n',
    });
    let selected: CheckInput = buildCheckInput(await openSession(sandbox.path), 'markdown/fences', {
        paths: ['a.md'],
    });
    const found = await fences(selected);
    expect(found).toMatchObject([{ check: 'markdown/fences', file: 'a.md', line: 2, rule: 'syntax', fixable: false }]);
    expect(found[0]!.message).toContain('syntax error');
    await writeFile(join(sandbox.path, 'a.md'), '```bash\nprintf "%s\\n" "Hello"\n```\n');
    selected = buildCheckInput(await openSession(sandbox.path), 'markdown/fences', { paths: ['a.md'] });
    expect(await fences(selected)).toStrictEqual([]);
    selected.cancelSignal = AbortSignal.abort();
    expect(await rejection(fences(selected))).toBe('The command was canceled.');
});

test.each(['tsx', 'jsx'])('a %s fence rejects unclosed JSX and accepts its correction', async (language) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['markdown'], { level: 'all' }),
        'example.md': '```' + language + '\nexport const panel = <div>Hello;\n```',
    });
    expect(await fences(buildCheckInput(await openSession(sandbox.path), 'markdown/fences'))).toMatchObject([
        { file: 'example.md', line: 2, rule: 'syntax' },
    ]);
    await writeFile(
        join(sandbox.path, 'example.md'),
        '```' + language + '\nexport const panel = <div>Hello</div>;\n```',
    );
    expect(await fences(buildCheckInput(await openSession(sandbox.path), 'markdown/fences'))).toStrictEqual([]);
});
