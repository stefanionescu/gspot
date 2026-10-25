import { join } from 'node:path';
import * as prettier from 'prettier';
import { type Options } from 'prettier';
import { parse as parseYaml } from 'yaml';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { parse as parseJsonc } from 'jsonc-parser';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { stringify, parse as parseToml } from '@decimalturn/toml-patch';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { runGit, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { findRuleFilePath, findManifestTarget } from '#tests/setup/cli/generated-files.ts';

test.each(['absent', 'authored', 'managed'])(
    '%s attributes keep LF in generated files, also in a scope folder with a space',
    async (source) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['security', 'format'], {
                scopes: [{ path: 'web app', configurations: ['security', 'javascript', 'css'] }],
            }),
            'web app/page.js': 'export const page = 1;\n',
            'web app/style.css': 'a { color: red; }\n',
            ...(source !== 'absent' && {
                '.gitattributes':
                    source === 'authored'
                        ? '* text=auto eol=lf\n'
                        : '# >>> gspot managed >>>\n* text=auto eol=lf\n# <<< gspot managed <<<\n',
            }),
        });

        const generated = generate(await openSession(sandbox.path));
        const attributes = generated.blocks.find(({ path }) => path === '.gitattributes')!;
        expect(attributes.block.includes(' text eol=lf')).toBe(source !== 'authored');
        await writeFile(
            join(sandbox.path, '.gitattributes'),
            `${source === 'authored' ? '* text=auto eol=lf\n' : ''}${attributes.block}\n`,
        );
        const outside = generated.files.map(({ path }) => path).filter((path) => !path.startsWith(`${DOT_GSPOT}/`));
        expect(outside).toContain('web app/.stylelintrc.yml');
        const read = runGitStep(sandbox.path, ['check-attr', 'eol', '--', ...outside, 'nested/.editorconfig']);
        expect(read.split('\n')).toStrictEqual([
            ...outside.map((path) => `${path}: eol: lf`),
            `nested/.editorconfig: eol: ${source === 'authored' ? 'lf' : 'unspecified'}`,
        ]);
    },
);
test('generated attributes keep LF through an autocrlf checkout', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        '.gitattributes': '*.txt text\n',
    });

    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const path = findRuleFilePath('engineering', 'WORKING.md');
    const bytes = await readFile(join(sandbox.path, path));
    runGitStep(sandbox.path, ['add', '--', '.gitattributes', path]);
    await rm(join(sandbox.path, path));
    const checked = runGit(sandbox.path, ['-c', 'core.autocrlf=true', 'checkout-index', '--force', '--', path]);
    expect(checked.code, checked.stderr).toBe(0);
    const checkedBytes = await readFile(join(sandbox.path, path));
    expect(checkedBytes).toStrictEqual(bytes);
});
test.each([true, false])(
    'apply refuses a folder outside Git and writes its ignore block after Git init (%p)',
    async (authored) => {
        await using sandbox = await testdir();
        const previous = '# Authored entries\nprivate.tmp\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([]),
            ...(authored && { '.gitignore': previous }),
        });
        const refused = await runGspot(sandbox.path, ['apply']);
        expect(refused.code).toBe(2);
        const path = join(sandbox.path, '.gitignore');
        expect((await isOnDisk(path)) ? await readFile(path, 'utf8') : undefined).toBe(authored ? previous : undefined);
        const initialized = runGit(sandbox.path, ['init', '--quiet']);
        expect(initialized.code, initialized.stderr).toBe(0);
        await applyGeneratedFiles(sandbox.path);
        const installed = await readFile(path, 'utf8');
        expect(installed.startsWith(previous)).toBe(authored);
        expect(installed).toContain(`${GSPOT_PATHS.state}/`);
        await applyGeneratedFiles(sandbox.path);
        expect(await readFile(path, 'utf8')).toBe(installed);
    },
);

test('generated scope settings stay identical across process collations', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'commits'], {
            scopes: [
                { path: 'yam', configurations: ['javascript'] },
                { path: 'jam', configurations: ['javascript'] },
            ],
        }),
        'yam/package.json': '{"private":true}',
        'jam/package.json': '{"private":true}',
    });
    const expected = generate(await openSession(sandbox.path));
    using _collation = spyOn(String.prototype, 'localeCompare').mockImplementation(() => {
        throw new Error('Generated text must not depend on process collation.');
    });
    const session = await openSession(sandbox.path);
    expect(session.scopes.map(({ folder }) => folder.path)).toStrictEqual(['', 'jam', 'yam']);
    expect(generate(session)).toStrictEqual(expected);
});

test('adding the first Markdown and LFS files leaves generated output unchanged', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { tables: '[hooks]\nenabled = true\n' }),
        'package.json': '{"packageManager":"npm@11.0.0"}',
        'source.ts': 'export {};\n',
    });
    const before = generate(await openSession(sandbox.path));
    await createFileTree(sandbox.path, {
        'README.md': '# Notes\n',
        '.gitattributes': '*.bin filter=lfs diff=lfs merge=lfs -text\n',
        'blob.bin': Buffer.from([0]),
    });
    runGitStep(sandbox.path, ['add', '-A']);
    expect(generate(await openSession(sandbox.path))).toStrictEqual(before);
});

test('format.indent_width reaches EditorConfig, Prettier and each config file', async () => {
    const width = 6;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['format', 'data-files', 'python', 'swift', 'sql', 'markdown', 'bash'], {
            level: 'all',
            rules: true,
            tables: stringify({ format: { indent_width: width } }),
        }),
        'sample.yaml': 'parent:\n child: value\n',
        'sample.sh': 'echo example\n',
        'sample.md': '# Sample\n',
        'sample.py': 'value = 1\n',
        'sample.sql': 'SELECT 1;\n',
        'Sample.swift': 'let value = 1\n',
    });

    const session = await openSession(sandbox.path);
    const generated = new Map(generate(session).files.map((file) => [file.path, file.content]));
    await writeFile(join(sandbox.path, '.editorconfig'), generated.get('.editorconfig')!);
    const path = join(sandbox.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    expect(editor?.tabWidth).toBe(width);
    const configuration = JSON.parse(generated.get(findManifestTarget('format', 'prettier.json'))!) as Options;
    expect(configuration.tabWidth).toBe(width);
    const markdownlint: unknown = parseJsonc(generated.get(findManifestTarget('markdown', 'markdownlint.jsonc'))!);
    expect(markdownlint).not.toHaveProperty('MD007');
    const parsed: unknown = parseYaml(generated.get(findManifestTarget('data-files', 'yamllint.yml'))!);
    expect(parsed).toMatchObject({
        rules: { anchors: {}, 'key-duplicates': {}, truthy: { 'check-keys': false } },
    });
    const yamllint: unknown = parseYaml(generated.get(findManifestTarget('data-files', 'yamllint.yml'))!);
    expect(yamllint).not.toHaveProperty('rules.indentation');
    const ruff: unknown = parseToml(generated.get(findManifestTarget('python', 'ruff.toml'))!);
    expect(ruff).toHaveProperty('indent-width', width);
    const taplo: unknown = parseToml(generated.get(findManifestTarget('data-files', 'taplo.toml'))!);
    expect(taplo).toMatchObject({
        formatting: { indent_string: ' '.repeat(width) },
    });
    expect(generated.get(findManifestTarget('sql', 'sqlfluff.cfg'))).toContain(`tab_space_size = ${String(width)}`);
    expect(generated.get(findManifestTarget('swift', 'swiftformat'))).toContain(`--indent ${String(width)}\n`);
});
