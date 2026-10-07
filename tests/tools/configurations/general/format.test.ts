import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { buildToolsPath, installToolProjects } from '#tests/harness/install.ts';
import { FORMAT_CASES, FORMAT_OVERRIDES_POLICY } from '#tests/config/samples/formatting.ts';

async function expectFormatterCorrection(root: string): Promise<void> {
    const args = ['check', '--only', 'format/prettier', '--json'];
    const files = FORMAT_CASES.map(({ file }) => file);
    const before = await spawnGspot(root, [...args, '--', ...files]);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    const report = JSON.parse(before.stdout) as RunReport;
    expect(
        report.checks
            .flatMap(({ findings }) => findings.map(({ file }) => file))
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(files.toSorted((left, right) => left.localeCompare(right)));
    const corrected = await spawnGspot(root, [...args, '--fix', '--', ...files]);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    for (const { file, tabWidth, singleQuote, semi, endOfLine } of FORMAT_CASES) {
        const quote = singleQuote ? "'" : '"';
        const terminator = semi ? ';' : '';
        const ending = endOfLine === 'crlf' ? '\r\n' : '\n';
        expect(readFileSync(join(root, file), 'utf8')).toBe(
            [
                `const greeting = ${quote}hello${quote}${terminator}`,
                'if (greeting) {',
                `${' '.repeat(tabWidth)}console.log(greeting)${terminator}`,
                '}',
                '',
            ].join(ending),
        );
    }
    const editor = await spawnGspot(
        root,
        ['check', '--only', 'format/editorconfig-checker', '--json', '--', ...files],
        {
            PATH: buildToolsPath(['ec']),
        },
    );
    expect(editor.code, editor.stdout + editor.stderr).toBe(0);
}

test('formatter overrides drive CLI findings and correction without EditorConfig conflicts', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': FORMAT_OVERRIDES_POLICY,
        'package.json': '{"private":true}\n',
        ...Object.fromEntries(
            FORMAT_CASES.map(({ file }) => [file, 'const greeting="hello";if(greeting){console.log(greeting);}']),
        ),
    });
    const applied = await spawnGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(directory.path);
    await expectFormatterCorrection(directory.path);
    const { path: root } = directory;
    const reason = 'Generated outputs retain their upstream layout except the reviewed file.';
    await createFileTree(root, {
        'generated/kept.json': '{"value":1}',
        'generated/review.json': '{"value":1}',
    });
    const reasons = await spawnGspot(root, ['set', 'require_reasons', 'true']);
    expect(reasons.code, reasons.stdout + reasons.stderr).toBe(0);
    const excluded = await spawnGspot(root, [
        'set',
        'tools.prettier.exclude',
        '["generated/**","!generated/review.json"]',
        '--replace',
        '--reason',
        reason,
    ]);
    expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);
    const args = ['check', '--only', 'format/prettier', '--json', '--', 'generated/kept.json', 'generated/review.json'];
    const failed = await spawnGspot(root, args);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'generated/review.json' },
    ]);
    const fixed = await spawnGspot(root, [...args.slice(0, 4), '--fix', ...args.slice(4)]);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(readFileSync(join(root, 'generated/kept.json'), 'utf8')).toBe('{"value":1}');
    expect(JSON.parse(readFileSync(join(root, 'generated/review.json'), 'utf8'))).toStrictEqual({ value: 1 });
    const removed = await spawnGspot(root, ['set', 'tools.prettier.exclude', 'generated/**', '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const exposed = await spawnGspot(root, args);
    expect(exposed.code, exposed.stdout + exposed.stderr).toBe(1);
    expect((JSON.parse(exposed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'generated/kept.json' },
    ]);
    const corrected = await spawnGspot(root, [...args.slice(0, 4), '--fix', ...args.slice(4)]);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks.every(({ findings }) => findings.length === 0)).toBe(
        true,
    );
});
