import { readFile, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import { parse as parseToml, stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';
import { parse as parseIni } from 'ini';
import { type ParseError, parse as parseJsonc } from 'jsonc-parser';
import * as prettier from 'prettier';
import type { Options } from 'prettier';
import { createFileTree } from 'testdirs';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';

import { GSPOT_PATHS, LEVELS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { hasGeneratedHeader } from '#cli/repository/files/classify.ts';
import { PROJECT_FILES, UNPARSED_CONFIGS } from '#tests/config/generation/generate.ts';
import { SWIFT_VALUE_SOURCE } from '#tests/config/setup/languages.ts';
import { getManifestTarget, getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';

function parseJson(text: string, path: string): void {
    const errors: ParseError[] = [];
    parseJsonc(text, errors, { allowTrailingComma: true });
    if (errors.length > 0) throw new Error(`${path}: JSON error at offset ${String((errors[0] as ParseError).offset)}`);
}

function parseModule(text: string, path: string): void {
    const result = ts.transpileModule(text, { reportDiagnostics: true, fileName: path });
    const errors = (result.diagnostics ?? []).map((message) =>
        ts.flattenDiagnosticMessageText(message.messageText, '\n'),
    );
    if (errors.length > 0) throw new Error(`${path}: ${errors.join('; ')}`);
}

function parseConfig(text: string, path: string): void {
    const parsers: Record<string, (text: string, path: string) => void> = {
        coveragerc: (text) => {
            parseIni(text);
        },
        '.cfg': (text) => {
            parseIni(text);
        },
        '.ini': (text) => {
            parseIni(text);
        },
        '.json': (text) => {
            JSON.parse(text);
        },
        '.jsonc': parseJson,
        'pyrightconfig.json': parseJson,
        '.webmanifest': (text) => {
            JSON.parse(text);
        },
        '.toml': (text) => {
            parseToml(text);
        },
        '.yml': (text) => {
            parseYaml(text);
        },
        '.yaml': (text) => {
            parseYaml(text);
        },
        '.mjs': (text, path) => {
            const result = runBlockingCommand(['node', '--input-type=module', '--check'], {
                cwd: process.cwd(),
                stdin: text,
            });
            if (result.code !== 0) throw new Error(`${path}: ${result.stderr}`);
        },
        '.cjs': parseModule,
        '.js': parseModule,
        '.ts': parseModule,
    };

    const parser = parsers[basename(path)] ?? parsers[extname(path)];
    if (parser === undefined) throw new Error(`${path}: no generated-file parser is declared.`);
    parser(text, path);
}

test.each(['ios app', 'web [old]'])(
    'generated attributes mark the generated files of the scope folder %p',
    async (scope) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], { scopes: [{ path: scope, configurations: ['swift'] }] }),
            [`${scope}/Value.swift`]: SWIFT_VALUE_SOURCE,
        });
        const generated = buildGeneratedFiles(await openSession(sandbox.path));
        const attributes = generated.blocks.find(({ path }) => path === '.gitattributes')!;
        await writeFile(join(sandbox.path, '.gitattributes'), `${attributes.body}\n`);
        const pointer = `${scope}/.swiftlint.yml`;
        const checked = runBlockingCommand(['git', 'check-attr', 'linguist-generated', '--', pointer], {
            cwd: sandbox.path,
            env: {},
        });
        expect(checked.stdout).toBe(`${pointer}: linguist-generated: set\n`);
    },
);

test('generated attributes keep LF through an autocrlf checkout', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        '.gitattributes': '*.txt text\n',
    });

    await applyGeneratedFiles(sandbox.path);
    const path = getRuleFilePath('agents', 'WORKING.md');
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

test.each([...LEVELS])(
    'every shipped configuration together at level %s generates each sourced config once, in files that parse and that carry the header outside .gspot',
    async (level) => {
        const configurations = readConfigurations().values().toArray();
        const names = configurations.filter((configuration) => !configuration.always_selected).map(({ name }) => name);
        await using sandbox = await createGitSandbox({
            ...PROJECT_FILES,
            'gspot.toml': buildSandboxSettings(names, {
                level,
                rules: true,
                tables: '[hooks]\nenabled = true\n\n[ci]\nenabled = true\n\n[openapi]\ndocument = "openapi.yaml"\n',
                scopes: [{ path: 'app', configurations: names }],
            }),
            'app/package.json': '{"private":true}',
            'app/style.css': 'a { color: red; }\n',
        });
        await linkInstalledModules(join(sandbox.path, 'node_modules'));
        const generated = buildGeneratedFiles(await openSession(sandbox.path));
        const paths = [...generated.files, ...generated.blocks, ...generated.managedKeys].map(({ path }) =>
            path.normalize('NFC').toLowerCase(),
        );
        const sourced = configurations.flatMap(({ configs }) =>
            configs
                .filter(({ source }) => source !== undefined)
                .map(({ target }) => target.normalize('NFC').toLowerCase()),
        );
        // Below level all, the config of a check that is off is not written.
        expect(level === 'all' ? sourced.filter((target) => !paths.includes(target)) : []).toStrictEqual([]);
        expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toStrictEqual([]);
        const outside = generated.files.filter(({ path }) => !path.startsWith(`${GSPOT_FOLDER}/`));
        expect(outside.filter(({ content }) => !hasGeneratedHeader(content)).map(({ path }) => path)).toStrictEqual([]);
        const configs = generated.files.filter(
            ({ path }) => !path.startsWith(`${GSPOT_FOLDER}/`) || path.startsWith(`${GSPOT_PATHS.configurations}/`),
        );
        const failures: Array<{ path: string; error: string }> = [];
        for (const file of configs) {
            if (new Set<string>(UNPARSED_CONFIGS).has(basename(file.path))) continue;
            try {
                parseConfig(file.content, file.path);
            } catch (error) {
                failures.push({ path: file.path, error: String(error) });
            }
        }
        expect(failures).toStrictEqual([]);
    },
);

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
        'README.md': '# Notes\n',
    });
    runGitStep(sandbox.path, ['add', '-A']);
    expect(buildGeneratedFiles(await openSession(sandbox.path))).toStrictEqual(before);
});

test('format.indent_width reaches EditorConfig, Prettier and each config file', async () => {
    const width = 6;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['format', 'toml', 'python', 'swift', 'sql', 'markdown', 'bash'], {
            level: 'all',
            rules: true,
            tables: stringify({ format: { indent_width: width } }),
        }),
        'sample.yaml': 'key: value\n',
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
    const taplo: unknown = parseToml(generated.get(getManifestTarget('toml', 'taplo.toml'))!);
    expect(taplo).toMatchObject({
        formatting: { indent_string: ' '.repeat(width) },
    });
    expect(generated.get(getManifestTarget('sql', 'sqlfluff.cfg'))).toContain(`tab_space_size = ${String(width)}`);
    expect(generated.get(getManifestTarget('swift', 'swiftformat'))).toContain(`--indent ${String(width)}\n`);
});
