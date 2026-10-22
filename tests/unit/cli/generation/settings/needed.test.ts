import ts from 'typescript';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse as parseIni } from 'ini';
import { parse as parseYaml } from 'yaml';
import { openSession } from '#cli/session.ts';
import { getValueAt } from '#cli/system/tables.ts';
import { join, extname, basename } from 'node:path';
import { LEVELS } from '#cli/config/configurations.ts';
import { generate } from '#cli/generation/generate.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { listNeededTools } from '#cli/planning/needed-tools.ts';
import { getToolFiles } from '#cli/generation/settings/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { type ParseError, parse as parseJsonc } from 'jsonc-parser';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { getToolFileTarget } from '#cli/generation/settings/needed.ts';
import { listToolProjectPins } from '#cli/configurations/declared-tools.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';

import {
    TOOL_FILE_PROJECT,
    IGNORED_CHECK_FILES,
    UNPARSED_TOOL_FILES,
    NESTED_PYTHON_GSPOT_TOML,
    JSCONFIG_TITLE_IGNORE_PROJECT,
} from '#tests/data/generation/settings/needed.ts';

test('a Ruff-only Python scope gets no type checker file or pointer', async () => {
    await using sandbox = await testdir({
        'gspot.toml': NESTED_PYTHON_GSPOT_TOML,
        'linted/source.py': 'value = 1\n',
        'typed/source.py': 'value: int = 1\n',
    });

    const paths = generate(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.gspot/configurations/language/python/ruff.toml');
    expect(paths).toContain('linted/ruff.toml');
    expect(paths).toContain('typed/ruff.toml');
    expect(paths).not.toContain('.gspot/configurations/language/python/scopes/linted/basedpyright.json');
    expect(paths).not.toContain('linted/pyrightconfig.json');
    expect(
        paths.filter((path) => path.startsWith('.gspot/configurations/') && path.endsWith('/ruff.toml')),
    ).toHaveLength(1);
    expect(paths).toContain('.gspot/configurations/language/python/basedpyright.json');
    expect(paths).toContain('typed/pyrightconfig.json');
});
test('a TypeScript-only scope gets the Knip file and no jsconfig', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'src/main.ts': 'export const value = 1;\n',
    });

    const session = await openSession(sandbox.path);
    const paths = generate(session).files.map((file) => file.path);
    expect(paths).toContain('.gspot/configurations/language/javascript/knip.json');
    expect(paths).not.toContain('.gspot/configurations/language/javascript/jsconfig.json');
});
test.each([...IGNORED_CHECK_FILES])(
    '$name and drops the files of the ignored checks',
    async ({ settings, files, kept, dropped }) => {
        await using sandbox = await testdir({ 'gspot.toml': settings, ...files });

        const paths = generate(await openSession(sandbox.path)).files.map((file) => file.path);
        for (const path of kept) expect(paths).toContain(path);
        for (const path of dropped) expect(paths).not.toContain(path);
    },
);
test('Go and Rust sources get only the formatter files and tools they use', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { level: 'all' }),
        'main.go': 'package main\nfunc main() {}\n',
        'main.rs': 'fn main() {}\n',
    });

    const session = await openSession(sandbox.path);
    const files = generate(session).files;
    const paths = files.map((file) => file.path);
    expect(paths).toContain('.editorconfig');
    expect(paths).toContain('.gspot/configurations/general/data-files/taplo.toml');
    for (const path of ['.gspot/configurations/general/format/prettier.json', '.prettierignore'])
        expect(paths).not.toContain(path);
    const packages = listToolProjectPins(session.neededToolConfigurations).npm;
    const expected = listToolProjectPins([session.configurations.get('data-files')!]).npm;
    expect(Object.keys(packages).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(
        Object.keys(expected).toSorted((first, second) => first.localeCompare(second)),
    );
});
test.each([...LEVELS])("every configuration's tool files parse at level %s", async (level) => {
    const configurations = [...readConfigurations().values()]
        .filter((configuration) => configuration.toolFiles.length > 0)
        .map((configuration) => configuration.name);
    await using sandbox = await testdir({
        ...TOOL_FILE_PROJECT,
        'gspot.toml': buildSandboxSettings(configurations, { level, rules: true }),
    });

    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    const session = await openSession(sandbox.path);
    const output = generate(session);
    const generated = output.files.filter(
        (file) =>
            !file.path.startsWith('.gspot/') ||
            (file.path.startsWith('.gspot/configurations/') && !file.path.includes('/rules/')),
    );
    const selected = new Set(
        session.scopes
            .flatMap((scope) => scope.configurations)
            .filter((configuration) => configurations.includes(configuration.name))
            .map((configuration) => configuration.name),
    );
    expect(selected).toStrictEqual(new Set(configurations));
    const paths = new Set(generated.map((file) => file.path));
    const checks = session.configuredChecks;
    const checkIds = new Set(checks.map((entry) => entry.check.id));
    const tools = new Set(checks.flatMap((entry) => listNeededTools(entry)));
    for (const { folder, configurations } of session.scopes) {
        const targets = configurations
            .flatMap((configuration) => configuration.toolFiles)
            .filter((file) => file.level !== 'all' || level === 'all')
            .filter((file) => file.tool.length === 0 || file.tool.some((name) => tools.has(name)))
            .filter((file) => file.check.length === 0 || file.check.some((name) => checkIds.has(name)))
            .map((file) => getToolFileTarget(folder.path, file, getToolFiles(session).targets));
        expect(targets.length).toBeGreaterThan(0);
        expect(new Set(targets).difference(paths)).toStrictEqual(new Set<string>());
    }
    for (const file of generated) {
        if (new Set<string>(UNPARSED_TOOL_FILES).has(basename(file.path))) continue;
        parseToolFile(file.content, file.path);
    }
});
test('an ignore whose reason equals a built-in section title keeps its paths in the jsconfig exclude', async () => {
    await using sandbox = await testdir(JSCONFIG_TITLE_IGNORE_PROJECT);
    const files = generate(await openSession(sandbox.path)).files;
    const content = files.find(
        ({ path }) => path === '.gspot/configurations/language/javascript/jsconfig.json',
    )!.content;
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

/** Parse a generated tool file with the parser for its extension. */
function parseToolFile(text: string, path: string): void {
    const parsers: Record<string, (text: string, path: string) => void> = {
        '.cfg': (text) => {
            parseIni(text);
        },
        '.ini': (text) => {
            parseIni(text);
        },
        '.json': (text) => void JSON.parse(text),
        '.jsonc': parseJson,
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

    const parser = parsers[extname(path)];
    if (parser === undefined) throw new Error(`${path}: no generated-file parser is declared.`);
    parser(text, path);
}
