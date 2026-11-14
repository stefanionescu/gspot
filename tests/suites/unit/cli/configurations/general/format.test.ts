import { join } from 'node:path';
import * as prettier from 'prettier';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { GREETING_SOURCE } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { getManifestTarget, buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';

const FORMAT_OVERRIDES_SETTINGS = `level = "all"\nconfigurations = ["format", "javascript"]\n[rule_files]\nenabled = false\n[format]\nindent_width = 2\nquotes = "double"\nsemicolons = false\n[[format.override]]\npaths = ["tests/**"]\nquotes = "single"\nsemicolons = true\n[[format.override]]\npaths = ["apps/web/**", "!apps/web/exempt.js"]\nquotes = "single"\n[[format.override]]\npaths = ["apps/web/admin/**"]\nquotes = "double"\nsemicolons = true\n[[scope]]\npath = "apps/web"\n[scope.format]\nindent_width = 4\n[[scope]]\npath = "apps/web/admin"\n[scope.format]\nindent_width = 8\n`;

const PRETTIER_OPTIONS_BY_FILE = [
    { file: 'source.js', tabWidth: 2, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'tests/unit.js', tabWidth: 2, singleQuote: true, semi: true, endOfLine: 'lf' },
    { file: 'apps/web/café note.js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/exempt.js', tabWidth: 4, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/admin/page.js', tabWidth: 8, singleQuote: false, semi: true, endOfLine: 'lf' },
] as const;

test('a format override selector that EditorConfig cannot express is a settings error', async () => {
    const format = { override: [{ paths: ['src/*.+(ts|js)'], indent_width: 2 }] };
    const generated = buildGeneratedFile(
        buildSandboxSettings(['format'], { tables: stringify({ format }) }),
        getManifestTarget('format', '.editorconfig'),
        {},
    );
    expect(await captureRejection(generated)).toMatchObject({
        name: 'GspotError',
        code: 'settings',
        message: expect.stringContaining('"src/*.+(ts|js)"') as string,
    });
});

test('Prettier loads the selected plugin through the root pointer file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['svelte']),
        'source.svelte': '<h1>Example</h1>\n',
    });
    const generated = buildGeneratedFiles(await openSession(sandbox.path));
    await createFileTree(sandbox.path, Object.fromEntries(generated.files.map(({ path, content }) => [path, content])));
    const editorOptions = await prettier.resolveConfig(join(sandbox.path, 'source.svelte'), {
        config: join(sandbox.path, 'prettier.config.mjs'),
        useCache: false,
    });
    expect(editorOptions?.plugins).toStrictEqual([
        join(sandbox.path, GSPOT_PATHS.nodeModules, 'prettier-plugin-svelte/plugin.js'),
    ]);
});

test('plugin overrides come before the format overrides', async () => {
    const settings = {
        configurations: ['astro'],
        format: { override: [{ paths: ['docs/**'], print_width: 80 }] },
    };
    const { overrides } = JSON.parse(
        await buildGeneratedFile(stringify(settings), getManifestTarget('format', 'prettier.json'), {
            'source.astro': '<h1>Example</h1>\n',
        }),
    ) as { overrides: unknown[] };
    expect(overrides.slice(-2)).toMatchObject([
        { files: '*.astro' },
        { files: ['docs/**'], options: { printWidth: 80 } },
    ]);
});

test('Prettier overrides agree in the root pointer file and editor lookup', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': FORMAT_OVERRIDES_SETTINGS,
        'package.json': '{"private":true}\n',
        ...Object.fromEntries(PRETTIER_OPTIONS_BY_FILE.map(({ file }) => [file, GREETING_SOURCE])),
    });
    const root = sandbox.path;
    await applyGeneratedFiles(root);
    for (const { file, ...expected } of PRETTIER_OPTIONS_BY_FILE) {
        const config = await prettier.resolveConfig(join(root, file), {
            config: join(root, 'prettier.config.mjs'),
            editorconfig: true,
            useCache: false,
        });
        expect(config, file).toMatchObject(expected);
        expect(await prettier.resolveConfig(join(root, file), { editorconfig: true, useCache: false })).toMatchObject(
            expected,
        );
    }
    await writeFile(join(root, 'tests/future.js'), GREETING_SOURCE);
    expect(
        await prettier.resolveConfig(join(root, 'tests/future.js'), {
            config: join(root, 'prettier.config.mjs'),
            useCache: false,
        }),
    ).toMatchObject({ singleQuote: true, semi: true });
});
