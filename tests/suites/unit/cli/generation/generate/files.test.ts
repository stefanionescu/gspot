import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseToml, stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';
import * as prettier from 'prettier';
import { type Options } from 'prettier';
import { createFileTree } from 'testdirs';

import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { CONFIG_PROJECT, NESTED_YAML, NOTES_MARKDOWN } from '#tests/config/setup/configurations.ts';
import { SWIFT_VALUE_SOURCE } from '#tests/config/setup/languages.ts';
import { getManifestTarget, getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';

test.each(['absent'])('%s attributes keep LF in every text file, also in a scope folder with a space', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['security', 'format'], {
            scopes: [{ path: 'web app', configurations: ['security', 'javascript', 'css'] }],
        }),
        'web app/page.js': 'export const page = 1;\n',
        'web app/style.css': 'a { color: red; }\n',
    });

    const generated = buildGeneratedFiles(await openSession(sandbox.path));
    const attributes = generated.blocks.find(({ path }) => path === '.gitattributes')!;
    expect(attributes.body).toStartWith('* text=auto eol=lf\n.gspot/** linguist-generated\n');
    await writeFile(join(sandbox.path, '.gitattributes'), `${attributes.body}\n`);
    const outside = generated.files.map(({ path }) => path).filter((path) => !path.startsWith(`${GSPOT_FOLDER}/`));
    expect(outside).toContain('.stylelintrc.yml');
});

test('generated attributes keep LF through an autocrlf checkout', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        '.gitattributes': '*.txt text\n',
    });

    await applyGeneratedFiles(sandbox.path);
    const path = getRuleFilePath('engineering', 'WORKING.md');
    const bytes = await readFile(join(sandbox.path, path));
    runGitStep(sandbox.path, ['add', '--', '.gitattributes', path]);
    await rm(join(sandbox.path, path));
    const checked = runBlockingCommand(['git', '-c', 'core.autocrlf=true', 'checkout-index', '--force', '--', path], {
        cwd: sandbox.path,
        env: {},
    });
    expect(checked.code, checked.stderr).toBe(0);
    const checkedBytes = await readFile(join(sandbox.path, path));
    expect(checkedBytes).toStrictEqual(bytes);
});

test('every shipped configuration together builds each source config and generates each path once, ignoring case', async () => {
    const configurations = readConfigurations().values().toArray();
    const names = configurations.filter((configuration) => !configuration.always_selected).map(({ name }) => name);
    await using sandbox = await createGitSandbox({
        ...CONFIG_PROJECT,
        'gspot.toml': buildSandboxSettings(names, {
            level: 'all',
            rules: true,
            tables: '[hooks]\nenabled = true\n\n[ci]\nenabled = true\n\n[openapi]\ndocument = "openapi.yaml"\n',
            scopes: [{ path: 'app', configurations: names }],
        }),
        'openapi.yaml': 'openapi: 3.1.0\ninfo:\n  title: Example\n  version: 1.0.0\npaths: {}\n',
        'app/package.json': '{"private":true}',
        'app/style.css': 'a { color: red; }\n',
    });
    const generated = buildGeneratedFiles(await openSession(sandbox.path));
    const paths = [...generated.files, ...generated.blocks, ...generated.managedKeys].map(({ path }) =>
        path.normalize('NFC').toLowerCase(),
    );
    const sourced = configurations.flatMap(({ configs }) =>
        configs.filter(({ source }) => source !== undefined).map(({ target }) => target.normalize('NFC').toLowerCase()),
    );
    expect(paths).toContain('.stylelintrc.yml');
    expect(sourced.filter((target) => !paths.includes(target))).toStrictEqual([]);
    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toStrictEqual([]);
});

test('generated scope settings stay identical across process collations', async () => {
    await using sandbox = await createGitSandbox({
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

test('adding the first Markdown files leaves generated output unchanged', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"packageManager":"npm@11.0.0"}',
        'source.ts': 'export {};\n',
    });
    const before = buildGeneratedFiles(await openSession(sandbox.path));
    await createFileTree(sandbox.path, {
        'README.md': NOTES_MARKDOWN,
    });
    runGitStep(sandbox.path, ['add', '-A']);
    expect(buildGeneratedFiles(await openSession(sandbox.path))).toStrictEqual(before);
});

test('format.indent_width reaches EditorConfig, Prettier and each config file', async () => {
    const width = 6;
    await using sandbox = await createGitSandbox({
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
    const ruff: unknown = parseToml(generated.get(getManifestTarget('python', 'ruff.toml'))!);
    expect(ruff).toHaveProperty('indent-width', width);
    const taplo: unknown = parseToml(generated.get(getManifestTarget('data-files', 'taplo.toml'))!);
    expect(taplo).toMatchObject({
        formatting: { indent_string: ' '.repeat(width) },
    });
    expect(generated.get(getManifestTarget('sql', 'sqlfluff.cfg'))).toContain(`tab_space_size = ${String(width)}`);
    expect(generated.get(getManifestTarget('swift', 'swiftformat'))).toContain(`--indent ${String(width)}\n`);
});
