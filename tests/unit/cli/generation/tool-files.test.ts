import ts from 'typescript';
import { test, expect } from 'bun:test';
import { parse as parseIni } from 'ini';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { join, extname, basename } from 'node:path';
import { openSession } from '#cli/commands/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { stringify, parse as parseToml } from 'smol-toml';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { requiredToolNames } from '#cli/planning/needed-tools.ts';
import { EDITORCONFIG_SETTINGS } from '#tests/config/formatting.ts';
import { type ParseError, parse as parseJsonc } from 'jsonc-parser';
import { emitSettings, parseExpiryDate } from '#cli/settings/file.ts';
import { SWIFT_FORMAT_SETTINGS } from '#tests/config/swift/projects.ts';
import { NESTED_PYTHON_SETTINGS } from '#tests/config/python/project.ts';
import { createEslint, readEslintConfiguration } from '#tests/setup/generate.ts';
import { PLAIN_TOOL_FILES, TOOL_FILE_PROJECT } from '#tests/config/tool-files.ts';
import { getToolDeclaration, listToolProjectPins } from '#cli/configurations/tools.ts';

import {
    ODD_KEY,
    ODD_VALUE,
    REGISTRIES,
    XCODE_SCHEME,
    XCODE_PROJECT,
    ODD_VALUE_FILES,
    ODD_VALUE_SETTINGS,
} from '#tests/config/serialization.ts';

test('a Ruff-only Python scope gets no type checker file or pointer', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': NESTED_PYTHON_SETTINGS,
        'linted/source.py': 'value = 1\n',
        'typed/source.py': 'value: int = 1\n',
    });
    const paths = emitAll(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/linted/ruff.toml');
    expect(paths).not.toContain('.gspot/config/linted/basedpyrightconfig.json');
    expect(paths).not.toContain('linted/pyrightconfig.json');
    expect(paths).toContain('.gspot/config/typed/ruff.toml');
    expect(paths).toContain('.gspot/config/typed/basedpyrightconfig.json');
    expect(paths).toContain('typed/pyrightconfig.json');
});

test('a TypeScript-only scope gets the Knip file and no jsconfig', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["typescript"]\n[rules]\nenabled = false\n',
        'src/main.ts': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const paths = emitAll(session).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/knip.json');
    expect(paths).not.toContain('.gspot/config/jsconfig.json');
});

test('ignoring SwiftLint and Periphery keeps SwiftFormat and drops their files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SWIFT_FORMAT_SETTINGS,
        'main.swift': 'let value = 1\n',
    });
    const paths = emitAll(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/swiftformat');
    expect(paths).not.toContain('.gspot/config/swiftlint.yml');
    expect(paths).not.toContain('.gspot/config/periphery.yml');
    expect(paths).not.toContain('.gspot/package.json');
});

test('EditorConfig stays without a Prettier file or ignore file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': EDITORCONFIG_SETTINGS,
        'sample.json': '{"value":1}\n',
    });
    const paths = emitAll(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.editorconfig');
    expect(paths).not.toContain('.gspot/config/prettier.json');
    expect(paths).not.toContain('.prettierignore');
});

test('Go and Rust sources get only the formatter files and tools they use', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], { level: 'all' }),
        'main.go': 'package main\nfunc main() {}\n',
        'main.rs': 'fn main() {}\n',
    });
    const session = await openSession(sandbox.path);
    const files = emitAll(session).files;
    const paths = files.map((file) => file.path);
    expect(paths).toContain('.editorconfig');
    expect(paths).toContain('.gspot/config/taplo.toml');
    for (const path of ['.gspot/config/prettier.json', '.prettierignore']) expect(paths).not.toContain(path);
    const packages = listToolProjectPins(session.neededToolManifests).npm;
    const manifests = readManifests();
    const fileManifest = manifests.get('files')!;
    const expected = listToolProjectPins([
        {
            ...fileManifest,
            tools: [...fileManifest.tools, getToolDeclaration(manifests.values(), 'editorconfig-checker')],
        },
    ]).npm;
    expect(Object.keys(packages).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(Object.keys(expected));
});

const PARSERS: Record<string, (text: string, path: string) => void> = {
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

function parseJson(text: string, path: string): void {
    const errors: ParseError[] = [];
    parseJsonc(text, errors, { allowTrailingComma: true });
    if (errors.length > 0) throw new Error(`${path}: JSON error at offset ${String(errors[0]!.offset)}`);
}

function parseModule(text: string, path: string): void {
    const result = ts.transpileModule(text, { reportDiagnostics: true, fileName: path });
    const errors = (result.diagnostics ?? []).map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    );
    if (errors.length > 0) throw new Error(`${path}: ${errors.join('; ')}`);
}

const configurations = [...readManifests().values()]
    .filter((manifest) => manifest.toolFiles.some((config) => !config.fragment))
    .map((manifest) => manifest.configuration.name);

test.each([...LEVELS])("every configuration's tool files parse at level %s", async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...TOOL_FILE_PROJECT,
        'gspot.toml': `level = "${level}"\nconfigurations = ${JSON.stringify(configurations)}\n`,
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const generated = output.files.filter((file) => file.kind === 'tool_file' || file.kind === 'pointer');
    const selected = new Set(
        session.scopes
            .flatMap((scope) => scope.selected)
            .filter((manifest) => configurations.includes(manifest.configuration.name))
            .map((manifest) => manifest.configuration.name),
    );
    expect(selected).toStrictEqual(new Set(configurations));
    const paths = new Set(generated.map((file) => file.path));
    const checks = session.configuredChecks;
    const checkNames = new Set(checks.map((entry) => entry.check.name));
    const tools = new Set(checks.flatMap((entry) => requiredToolNames(entry)));
    for (const { scope, selected: manifests } of session.scopes) {
        const targets = manifests
            .flatMap((manifest) => manifest.toolFiles)
            .filter((file) => !file.fragment)
            .filter((file) => file.level !== 'all' || level === 'all')
            .filter((file) => file.tool.length === 0 || file.tool.some((name) => tools.has(name)))
            .filter((file) => file.check.length === 0 || file.check.some((name) => checkNames.has(name)))
            .map((file) => buildScopeTarget(scope.path, file, paths));
        expect(targets.length).toBeGreaterThan(0);
        expect(new Set(targets).difference(paths)).toStrictEqual(new Set<string>());
    }
    for (const file of generated) {
        if (new Set<string>(PLAIN_TOOL_FILES).has(basename(file.path))) continue;
        const parser = PARSERS[extname(file.path)];
        if (parser === undefined) throw new Error(`${file.path}: no generated-file parser is declared.`);
        parser(file.content, file.path);
    }
});

test('odd JSON keys and YAML values stay literal in tool files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify(ODD_VALUE_SETTINGS),
        ...ODD_VALUE_FILES,
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    for (const path of ['.gspot/config/prettier.json', '.gspot/config/knip.json']) {
        const file = output.files.find((entry) => entry.path === path);
        expect(file).toBeDefined();
        const parsed: unknown = parseJsonc(file!.content);
        expect(parsed).toMatchObject({ [ODD_KEY]: ODD_VALUE });
    }
    const markdownRules = output.files.find(({ path }) => path === '.gspot/config/markdownlint.jsonc')!;
    expect(parseJsonc(markdownRules.content)).toMatchObject({ MD044: { names: [ODD_KEY, ODD_VALUE] } });
    const markdownCli = output.files.find((entry) => entry.path === '.gspot/config/markdownlint-cli2.mjs')!;
    const markdownPath = join(sandbox.path, markdownCli.path);
    await Bun.write(markdownPath, markdownCli.content);
    const toolResult = await runCommand(
        [
            process.execPath,
            '-e',
            'const {default: configuration} = await import(process.argv[1]); process.stdout.write(JSON.stringify(configuration.config));',
            pathToFileURL(markdownPath).href,
        ],
        { cwd: sandbox.path },
    );
    expect(toolResult.code, toolResult.stderr).toBe(0);
    expect(JSON.parse(toolResult.stdout)).toStrictEqual({
        extends: join(sandbox.path, '.gspot/config/markdownlint.jsonc'),
    });
    const yaml = new Map(
        output.files
            .filter((file) => /\.ya?ml$/u.test(file.path))
            .map((file) => [file.path, parseYaml(file.content) as unknown]),
    );
    expect(yaml.get('.gspot/config/periphery.yml')).toMatchObject({ project: XCODE_PROJECT, schemes: [XCODE_SCHEME] });
    expect(yaml.get('.gspot/config/hadolint.yml')).toMatchObject({ trustedRegistries: REGISTRIES });
    expect(yaml.get('.gspot/config/yamllint.yml')).toMatchObject({
        rules: { truthy: { 'allowed-values': ['yes', 'no'] }, indentation: { spaces: 'consistent' } },
    });
});

test('TOML tool files keep odd strings and option keys', async () => {
    const text = String.raw`café "quoted" \value # comment`;
    const path = 'docs/"draft"/**';
    const reason = 'Reviewed upstream.\n[extend]\nuseDefault = false';
    const option = 'custom."option"';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': emitSettings('', {
            configurations: ['secrets', 'dependencies', 'files', 'docs', 'python'],
            format: { indent_style: 'tab' },
            tools: {
                taplo: { extra: { value: { [option]: text, column_width: 88 }, reason } },
            },
            docs: { allowed_urls: { value: [text], reason } },
            ignore: [
                { check: 'python/ruff', rule: 'F401', paths: [path], reason },
                { check: 'dependencies/osv', rule: text, reason, until: parseExpiryDate('2099-09-20') },
                { check: 'dependencies/osv', rule: 'GHSA-path-specific', paths: [path], reason },
            ],
        }),
        'sample.py': 'value = 1',
        'sample.md': '# Sample',
        'package.json': '{"private":true}',
        'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const parsed = new Map(
        output.files.filter((file) => file.path.endsWith('.toml')).map((file) => [file.path, parseToml(file.content)]),
    );
    expect(parsed.get('.gspot/config/osv-scanner.toml')).toMatchObject({
        IgnoredVulns: [{ id: text, reason, ignoreUntil: new Date('2099-09-20T00:00:00.000Z') }],
    });
    expect(parsed.get('.gspot/config/taplo.toml')).toMatchObject({
        formatting: { [option]: text, column_width: 88, indent_string: '\t' },
    });
    expect(parsed.get('.gspot/config/lychee.toml')).toMatchObject({ exclude: [text] });
    expect(parsed.get('.gspot/config/ruff.toml')).toMatchObject({
        lint: { 'per-file-ignores': { [`../../${path}`]: ['F401'] } },
    });
});

test('tool file source values list the dependencies of each scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript', 'testing-library'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["javascript", "testing-library"]\n',
        }),
        'package.json': '{"private":true,"dependencies":{"@testing-library/react":"*"}}',
        'app/package.json': '{"private":true,"dependencies":{"@testing-library/vue":"*"}}',
        'sample.test.js': 'export const value = 1;\n',
        'app/sample.test.js': 'export const value = 1;\n',
    });
    const eslint = await createEslint(sandbox.path);
    const awaitedConfiguration = await readEslintConfiguration(eslint, 'sample.test.js');
    expect(awaitedConfiguration.rules['testing-library/no-dom-import']).toStrictEqual([2, 'react']);
    const nextAwaitedConfiguration = await readEslintConfiguration(eslint, 'app/sample.test.js');
    expect(nextAwaitedConfiguration.rules['testing-library/no-dom-import']).toStrictEqual([2, 'vue']);
});
