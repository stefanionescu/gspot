import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { buildToolsPath, installPrivateTools } from '#tests/harness/install.ts';
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
    await installPrivateTools(directory.path);
    await expectFormatterCorrection(directory.path);
});
