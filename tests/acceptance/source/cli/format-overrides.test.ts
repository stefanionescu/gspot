import prettier from 'prettier';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { exportedProfile } from '#cli/policy/profiles/export.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { toolsPath, installPrivateTools } from '#tests/support/cli/tools.ts';
import { FORMAT_OVERRIDES_POLICY } from '#tests/inputs/acceptance/source/cli/cli.ts';

const CASES = [
    { file: 'source.js', tabWidth: 2, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'tests/unit.js', tabWidth: 2, singleQuote: true, semi: true, endOfLine: 'lf' },
    { file: 'apps/web/café note.js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/[special].js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/exempt.js', tabWidth: 4, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/admin/page.js', tabWidth: 8, singleQuote: false, semi: true, endOfLine: 'crlf' },
];

async function expectFormatterDiscovery(root: string): Promise<void> {
    for (const { file, ...expected } of CASES) {
        for (const config of ['.gspot/config/prettier.json', '.prettierrc.json']) {
            const resolved = await prettier.resolveConfig(join(root, file), {
                config: join(root, config),
                editorconfig: true,
                useCache: false,
            });
            expect(resolved, `${file} via ${config}`).toMatchObject(expected);
        }
        expect(await prettier.resolveConfig(join(root, file), { editorconfig: true, useCache: false })).toMatchObject(
            expected,
        );
    }
    writeFileSync(join(root, 'tests/future.js'), 'const greeting="hello";');
    expect(
        await prettier.resolveConfig(join(root, 'tests/future.js'), {
            config: join(root, '.gspot/config/prettier.json'),
            useCache: false,
        }),
    ).toMatchObject({ singleQuote: true, semi: true });
}

async function expectFormatterCorrection(root: string): Promise<void> {
    const args = ['check', '--only', 'formatting/prettier', '--json', '--no-cache'];
    const files = CASES.map(({ file }) => file);
    const before = await run(root, [...args, '--', ...files]);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    const report = JSON.parse(before.stdout) as RunReport;
    expect(
        report.checks
            .flatMap(({ findings }) => findings.map(({ file }) => file))
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(files.toSorted((left, right) => left.localeCompare(right)));
    const corrected = await run(root, [...args, '--fix', '--', ...files]);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    for (const { file, tabWidth, singleQuote, semi, endOfLine } of CASES) {
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
    const editor = await run(
        root,
        ['check', '--only', 'formatting/editorconfig-checker', '--json', '--no-cache', '--', ...files],
        { PATH: toolsPath(['ec']) },
    );
    expect(editor.code, editor.stdout + editor.stderr).toBe(0);
}

test.each([
    { scenario: 'agree with explicit configuration and editor discovery', verify: expectFormatterDiscovery },
    { scenario: 'drive CLI findings and correction without EditorConfig conflicts', verify: expectFormatterCorrection },
])(
    'formatter overrides $scenario',
    async ({ verify }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': FORMAT_OVERRIDES_POLICY,
            'package.json': '{"private":true}\n',
            ...Object.fromEntries(
                CASES.map(({ file }) => [file, 'const greeting="hello";if(greeting){console.log(greeting);}']),
            ),
        });
        const applied = await run(directory.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(directory.path);
        await verify(directory.path);
    },
    30_000,
);

test('exported profiles omit repository-specific formatter overrides', () => {
    const exported = exportedProfile(FORMAT_OVERRIDES_POLICY, 'format.profile.toml');
    expect(exported.text).not.toContain('overrides');
    expect(exported.leftOut).toContain('format.overrides[0]: names a repository path');
});
