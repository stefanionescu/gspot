import { join } from 'node:path';
import * as prettier from 'prettier';
import { type Options } from 'prettier';
import { parse as parseYaml } from 'yaml';
import { test, spyOn, expect } from 'bun:test';
import { parse as parseJsonc } from 'jsonc-parser';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/planning/session.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { readConfigurations } from '#cli/manifests/read.ts';
import { NOTES_MARKDOWN } from '#tests/config/documents.ts';
import { SWIFT_VALUE_SOURCE } from '#tests/config/swift.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { NESTED_YAML } from '#tests/config/generation/documents.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { stringify, parse as parseToml } from '@decimalturn/toml-patch';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { getRuleFilePath, getManifestTarget } from '#tests/setup/cli/generated-files.ts';

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

        const generated = buildGeneratedFiles(await openSession(sandbox.path));
        const attributes = generated.blocks.find(({ path }) => path === '.gitattributes')!;
        expect(attributes.body.includes(' text eol=lf')).toBe(source !== 'authored');
        await writeFile(
            join(sandbox.path, '.gitattributes'),
            `${source === 'authored' ? '* text=auto eol=lf\n' : ''}${attributes.body}\n`,
        );
        const outside = generated.files.map(({ path }) => path).filter((path) => !path.startsWith(`${GSPOT_FOLDER}/`));
        expect(outside).toContain('.stylelintrc.yml');
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
    const path = getRuleFilePath('engineering', 'WORKING.md');
    const bytes = await readFile(join(sandbox.path, path));
    runGitStep(sandbox.path, ['add', '--', '.gitattributes', path]);
    await rm(join(sandbox.path, path));
    const checked = runCommandBlocking(['git', '-c', 'core.autocrlf=true', 'checkout-index', '--force', '--', path], {
        cwd: sandbox.path,
        env: {},
    });
    expect(checked.code, checked.stderr).toBe(0);
    const checkedBytes = await readFile(join(sandbox.path, path));
    expect(checkedBytes).toStrictEqual(bytes);
});

test.each([true, false])(
    'apply refuses a folder outside Git and writes its tool folder ignores after Git init (%p)',
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
        const initialized = runCommandBlocking(['git', 'init', '--quiet'], { cwd: sandbox.path, env: {} });
        expect(initialized.code, initialized.stderr).toBe(0);
        await applyGeneratedFiles(sandbox.path);
        const ignorePath = join(sandbox.path, GSPOT_PATHS.gitignore);
        const installed = await readFile(ignorePath, 'utf8');
        expect(installed).toBe('node_modules/\n.venv/\nvale/\n');
        expect((await isOnDisk(path)) ? await readFile(path, 'utf8') : undefined).toBe(authored ? previous : undefined);
        await applyGeneratedFiles(sandbox.path);
        expect(await readFile(ignorePath, 'utf8')).toBe(installed);
    },
);

test('every shipped configuration together generates each path once, ignoring case', async () => {
    const names = readConfigurations()
        .values()
        .filter((configuration) => !configuration.always_selected)
        .map(({ name }) => name)
        .toArray();
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(names, {
            level: 'all',
            rules: true,
            tables: '[hooks]\nenabled = true\n\n[ci]\nenabled = true\n',
            scopes: [{ path: 'app', configurations: names }],
        }),
        'app/package.json': '{"private":true}',
        'app/style.css': 'a { color: red; }\n',
    });
    const generated = buildGeneratedFiles(await openSession(sandbox.path));
    const paths = [...generated.files, ...generated.blocks, ...generated.managedKeys].map(({ path }) =>
        path.normalize('NFC').toLowerCase(),
    );
    expect(paths).toContain('.stylelintrc.yml');
    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toStrictEqual([]);
});

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
    const expected = buildGeneratedFiles(await openSession(sandbox.path));
    using _collation = spyOn(String.prototype, 'localeCompare').mockImplementation(() => {
        throw new Error('Generated text must not depend on process collation.');
    });
    const session = await openSession(sandbox.path);
    expect(session.scopes.map(({ path }) => path)).toStrictEqual(['', 'jam', 'yam']);
    expect(buildGeneratedFiles(session)).toStrictEqual(expected);
});

test('adding the first Markdown and LFS files leaves generated output unchanged', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"packageManager":"npm@11.0.0"}',
        'source.ts': 'export {};\n',
    });
    const before = buildGeneratedFiles(await openSession(sandbox.path));
    await createFileTree(sandbox.path, {
        'README.md': NOTES_MARKDOWN,
        '.gitattributes': '*.bin filter=lfs diff=lfs merge=lfs -text\n',
        'blob.bin': Buffer.from([0]),
    });
    runGitStep(sandbox.path, ['add', '-A']);
    expect(buildGeneratedFiles(await openSession(sandbox.path))).toStrictEqual(before);
});

test('format.indent_width reaches EditorConfig, Prettier and each config file', async () => {
    const width = 6;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['format', 'data-files', 'python', 'swift', 'sql', 'markdown', 'bash'], {
            level: 'all',
            rules: true,
            tables: stringify({ format: { indent_width: width } }),
        }),
        'sample.yaml': NESTED_YAML,
        'sample.sh': 'echo example\n',
        'sample.md': '# Sample\n',
        'sample.py': 'value = 1\n',
        'sample.sql': 'SELECT 1;\n',
        'Sample.swift': SWIFT_VALUE_SOURCE,
    });

    const session = await openSession(sandbox.path);
    const generated = new Map(buildGeneratedFiles(session).files.map((file) => [file.path, file.content]));
    await writeFile(join(sandbox.path, '.editorconfig'), generated.get('.editorconfig')!);
    const path = join(sandbox.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    expect(editor?.tabWidth).toBe(width);
    const configuration = JSON.parse(generated.get(getManifestTarget('format', 'prettier.json'))!) as Options;
    expect(configuration.tabWidth).toBe(width);
    const markdownlint: unknown = parseJsonc(generated.get(getManifestTarget('markdown', 'markdownlint.jsonc'))!);
    expect(markdownlint).not.toHaveProperty('MD007');
    const yamllint: unknown = parseYaml(generated.get(getManifestTarget('data-files', 'yamllint.yml'))!);
    expect(yamllint).not.toHaveProperty('rules.indentation');
    const ruff: unknown = parseToml(generated.get(getManifestTarget('python', 'ruff.toml'))!);
    expect(ruff).toHaveProperty('indent-width', width);
    const taplo: unknown = parseToml(generated.get(getManifestTarget('data-files', 'taplo.toml'))!);
    expect(taplo).toMatchObject({
        formatting: { indent_string: ' '.repeat(width) },
    });
    expect(generated.get(getManifestTarget('sql', 'sqlfluff.cfg'))).toContain(`tab_space_size = ${String(width)}`);
    expect(generated.get(getManifestTarget('swift', 'swiftformat'))).toContain(`--indent ${String(width)}\n`);
});
