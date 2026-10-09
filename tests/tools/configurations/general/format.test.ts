import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { levelSchema } from '#cli/parsers/schema/contracts.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { buildToolsPath, installToolProjects } from '#tests/harness/install.ts';
import { FORMAT_CASES, FORMAT_OVERRIDES_POLICY } from '#tests/config/samples/formatting.ts';
import { EDITORCONFIG_VIOLATIONS } from '#tests/config/tools/configurations/general/format.ts';

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
        expect(await readFile(join(root, file), 'utf8')).toBe(
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
            PATH: buildToolsPath(['editorconfig-checker']),
        },
    );
    expect(editor.code, editor.stdout + editor.stderr).toBe(0);
}

let directory: Awaited<ReturnType<typeof testdir>>;
let applied: Awaited<ReturnType<typeof spawnGspot>>;

beforeAll(async () => {
    directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': FORMAT_OVERRIDES_POLICY,
        'package.json': '{"private":true}\n',
        ...Object.fromEntries(
            FORMAT_CASES.map(({ file }) => [file, 'const greeting="hello";if(greeting){console.log(greeting);}']),
        ),
    });
    applied = await spawnGspot(directory.path, ['apply']);
    if (applied.code !== 0) throw new Error(applied.stdout + applied.stderr);
    await installToolProjects(directory.path);
});

afterAll(async () => {
    await directory[Symbol.asyncDispose]();
});

test('formatter overrides drive CLI findings and correction without EditorConfig conflicts', async () => {
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await expectFormatterCorrection(directory.path);
    const { path: root } = directory;
    const reason = 'Generated outputs retain their upstream layout except the reviewed file.';
    await createFileTree(root, {
        'generated/kept.json': '{"value":1}',
        'generated/review.json': '{"value":1}',
    });
    const excluded = await spawnGspot(root, [
        'ignore',
        'format/prettier',
        '--paths',
        'generated/kept.json',
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
    expect(await readFile(join(root, 'generated/kept.json'), 'utf8')).toBe('{"value":1}');
    expect(JSON.parse(await readFile(join(root, 'generated/review.json'), 'utf8'))).toStrictEqual({ value: 1 });
    const removed = await spawnGspot(root, ['ignore', 'format/prettier', '--paths', 'generated/kept.json', '--remove']);
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

test.each(levelSchema.options)(
    'EditorConfig leaves indentation to formatters and retains native file constraints at %s',
    async (level) => {
        const { path: root } = directory;
        await createFileTree(root, {
            'gspot.toml': buildPolicy(['format'], { level }),
            'indented.txt': '\tcontent\n',
        });
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const args = ['check', '--only', 'format/editorconfig-checker', '--json', '--'];
        const environment = { PATH: buildToolsPath(['editorconfig-checker']) };
        const accepted = await spawnGspot(root, [...args, 'indented.txt'], environment);
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        expect(await readFile(join(root, 'indented.txt'), 'utf8')).toBe('\tcontent\n');
        for (const { file, broken, corrected } of EDITORCONFIG_VIOLATIONS) {
            await createFileTree(root, { [file]: broken });
            const rejected = await spawnGspot(root, [...args, file], environment);
            expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
            const report = JSON.parse(rejected.stdout) as RunReport;
            expect(report.checks).toMatchObject([{ check: 'format/editorconfig-checker', status: 'failed' }]);
            expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toContain(file);
            expect(await readFile(join(root, file), 'utf8')).toBe(broken);
            await createFileTree(root, { [file]: corrected });
            const fixed = await spawnGspot(root, [...args, file], environment);
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            expect((JSON.parse(fixed.stdout) as RunReport).checks).toMatchObject([
                { check: 'format/editorconfig-checker', status: 'passed', findings: [] },
            ]);
            expect(await readFile(join(root, file), 'utf8')).toBe(corrected);
        }
    },
);
