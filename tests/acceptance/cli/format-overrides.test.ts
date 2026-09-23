import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import prettier from 'prettier';
import type { RunReport } from '#cli/output/report-types.ts';
import { exportedProfile } from '#cli/profile/export.ts';
import { installPrivateTools, run, toolsPath } from '#tests/support/cli/planted.ts';

const POLICY = `version = 1
level = "all"
presets = ["formatting"]
[rules]
install = false
[format]
indent_width = 2
quotes = "double"
semicolons = false
[[format.overrides]]
paths = ["tests"]
quotes = "single"
semicolons = true
[[scope]]
path = "apps/web"
[scope.format]
indent_width = 4
[[scope.format.overrides]]
paths = ["**/*", "!apps/web/exempt.js"]
quotes = "single"
[[scope]]
path = "apps/web/admin"
[scope.format]
indent_width = 8
[[scope.format.overrides]]
paths = ["**/*"]
quotes = "double"
semicolons = true
line_ending = "crlf"
`;
const CASES = [
    { file: 'source.js', tabWidth: 2, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'tests/unit.js', tabWidth: 2, singleQuote: true, semi: true, endOfLine: 'lf' },
    { file: 'apps/web/café note.js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/[special].js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/exempt.js', tabWidth: 4, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/admin/page.js', tabWidth: 8, singleQuote: false, semi: true, endOfLine: 'crlf' },
];

test('formatter overrides agree between direct tool configuration, editor discovery, and gspot correction', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': POLICY,
        'package.json': '{"private":true}\n',
        ...Object.fromEntries(
            CASES.map(({ file }) => [file, 'const greeting="hello";if(greeting){console.log(greeting);}']),
        ),
    });
    const applied = await run(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installPrivateTools(directory.path);
    for (const { file, ...expected } of CASES) {
        for (const config of ['.gspot/prettier.json', '.prettierrc.json']) {
            const resolved = await prettier.resolveConfig(join(directory.path, file), {
                config: join(directory.path, config),
                editorconfig: true,
                useCache: false,
            });
            expect(resolved, `${file} via ${config}`).toMatchObject(expected);
        }
        expect(
            await prettier.resolveConfig(join(directory.path, file), { editorconfig: true, useCache: false }),
        ).toMatchObject(expected);
    }
    const args = ['check', '--only', 'formatting/prettier', '--json', '--no-cache'];
    const files = CASES.map(({ file }) => file);
    const before = await run(directory.path, [...args, '--', ...files]);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    const report = JSON.parse(before.stdout) as RunReport;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file)).toSorted()).toEqual(
        files.toSorted(),
    );
    const corrected = await run(directory.path, [...args, '--fix', '--', ...files]);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    for (const { file, tabWidth, singleQuote, semi, endOfLine } of CASES) {
        const quote = singleQuote ? "'" : '"';
        const terminator = semi ? ';' : '';
        const ending = endOfLine === 'crlf' ? '\r\n' : '\n';
        expect(readFileSync(join(directory.path, file), 'utf8')).toBe(
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
        directory.path,
        ['check', '--only', 'formatting/editorconfig-checker', '--json', '--no-cache', '--', ...files],
        { PATH: toolsPath(['ec']) },
    );
    expect(editor.code, editor.stdout + editor.stderr).toBe(0);
    writeFileSync(join(directory.path, 'tests/future.js'), 'const greeting="hello";');
    expect(
        await prettier.resolveConfig(join(directory.path, 'tests/future.js'), {
            config: join(directory.path, '.gspot/prettier.json'),
            useCache: false,
        }),
    ).toMatchObject({ singleQuote: true, semi: true });
    const exported = exportedProfile(POLICY, 'format.profile.toml');
    expect(exported.text).not.toContain('overrides');
    expect(exported.leftOut).toContain('format.overrides[0]: names a repository path');
}, 30_000);
