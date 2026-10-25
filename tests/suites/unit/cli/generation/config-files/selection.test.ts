import ts from 'typescript';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse as parseIni } from 'ini';
import { parse as parseYaml } from 'yaml';
import { openSession } from '#cli/session.ts';
import { getValueAt } from '#cli/system/tables.ts';
import { join, extname, basename } from 'node:path';
import { generate } from '#cli/generation/generate.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { type ParseError, parse as parseJsonc } from 'jsonc-parser';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';

import {
    CONFIG_FILE_PROJECT,
    IGNORED_CHECK_FILES,
    UNPARSED_CONFIG_FILES,
    NESTED_PYTHON_SETTINGS,
} from '#tests/config/generation/config-files/selection.ts';

test('a Ruff-only Python scope gets no type checker file or pointer', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], NESTED_PYTHON_SETTINGS),
        'linted/source.py': 'value = 1\n',
        'typed/source.py': 'value: int = 1\n',
    });

    const paths = generate(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths.filter((path) => /ruff\.toml|pyright/u.test(path))).toStrictEqual([
        '.gspot/configurations/language/python/basedpyright.json',
        '.gspot/configurations/language/python/ruff.toml',
        'linted/ruff.toml',
        'typed/pyrightconfig.json',
        'typed/ruff.toml',
    ]);
});
test('a TypeScript-only scope gets the config files of its selected JavaScript checks', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'src/main.ts': 'export const value = 1;\n',
    });

    const session = await openSession(sandbox.path);
    const paths = generate(session).files.map((file) => file.path);
    const kept = [findManifestTarget('javascript', 'jsconfig.json'), findManifestTarget('javascript', 'knip.json')];
    expect(paths.filter((path) => kept.includes(path))).toStrictEqual(kept);
});
test.each([...IGNORED_CHECK_FILES])(
    '$name and drops the files of the ignored checks',
    async ({ settings, files, kept, dropped }) => {
        await using sandbox = await testdir({ 'gspot.toml': settings, ...files });

        const paths = generate(await openSession(sandbox.path)).files.map((file) => file.path);
        const listed = new Set<string>([...kept, ...dropped]);
        expect(paths.filter((path) => listed.has(path))).toStrictEqual([...kept]);
    },
);
test('Go and Rust sources keep the files and tools of every selected configuration', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { level: 'all' }),
        'main.go': 'package main\nfunc main() {}\n',
        'main.rs': 'fn main() {}\n',
    });

    const session = await openSession(sandbox.path);
    const files = generate(session).files;
    const paths = files.map((file) => file.path);
    expect(
        paths.filter((path) =>
            [
                '.editorconfig',
                findManifestTarget('data-files', 'taplo.toml'),
                findManifestTarget('format', 'prettier.json'),
                '.prettierignore',
            ].includes(path),
        ),
    ).toStrictEqual([
        '.editorconfig',
        '.gspot/configurations/general/data-files/taplo.toml',
        '.gspot/configurations/general/format/prettier.json',
        '.prettierignore',
    ]);
    expect(Object.keys(listToolProjectPins(session.toolConfigurations).npm)).toStrictEqual([
        'ajv',
        'jscpd',
        'prettier',
        'syncpack',
        'v8r',
    ]);
});
test.each([...LEVELS])("every configuration's generated config files parse at level %s", async (level) => {
    const configurations = readConfigurations()
        .values()
        .filter((configuration) => configuration.configFiles.length > 0)
        .map((configuration) => configuration.name)
        .toArray();
    await using sandbox = await testdir({
        ...CONFIG_FILE_PROJECT,
        'gspot.toml': buildSandboxSettings(configurations, { level, rules: true }),
    });

    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    const session = await openSession(sandbox.path);
    const output = generate(session);
    const generated = output.files.filter(
        (file) =>
            !file.path.startsWith(`${DOT_GSPOT}/`) ||
            (file.path.startsWith(`${GSPOT_PATHS.configurations}/`) && !file.path.includes('/rules/')),
    );
    for (const file of generated) {
        if (new Set<string>(UNPARSED_CONFIG_FILES).has(basename(file.path))) continue;
        parseConfigFile(file.content, file.path);
    }
});
test('an ignore whose reason equals a built-in section title keeps its paths in the jsconfig exclude', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            rules: true,
            tables: '[[ignore]]\npaths = ["legacy/**"]\nreason = "Build output"\n',
        }),
        'source.js': 'export const value = 1;\n',
        'legacy/source.js': 'export const legacy = 1;\n',
    });
    const files = generate(await openSession(sandbox.path)).files;
    const content = files.find(({ path }) => path === findManifestTarget('javascript', 'jsconfig.json'))!.content;
    const jsconfig: unknown = JSON.parse(content);
    expect(getValueAt(jsconfig, ['exclude'])).toContain('../../../../legacy/**');
});
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

function parseConfigFile(text: string, path: string): void {
    const parsers: Record<string, (text: string, path: string) => void> = {
        '.cfg': (text) => {
            parseIni(text);
        },
        '.ini': (text) => {
            parseIni(text);
        },
        '.json': (text) => void JSON.parse(text),
        '.jsonc': parseJson,
        'pyrightconfig.json': parseJson,
        '.webmanifest': (text) => void JSON.parse(text),
        '.toml': (text) => {
            parseToml(text);
        },
        '.yml': (text) => void parseYaml(text),
        '.yaml': (text) => void parseYaml(text),
        '.mjs': parseModule,
        '.cjs': parseModule,
        '.js': parseModule,
        '.ts': parseModule,
    };

    const parser = parsers[basename(path)] ?? parsers[extname(path)];
    if (parser === undefined) throw new Error(`${path}: no generated-file parser is declared.`);
    parser(text, path);
}
