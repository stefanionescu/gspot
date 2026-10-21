import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { openSession } from '#cli/session.ts';
import { getValueAt } from '#cli/system/tables.ts';
import { readGitOutput } from '#tests/setup/git.ts';
import { matchItems } from '#tests/setup/matchers.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { generate } from '#cli/generation/generate.ts';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import { listNeededTools } from '#cli/planning/needed-tools.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { getToolFiles } from '#cli/generation/settings/generate.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildScopeTarget } from '#cli/generation/settings/needed.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { createEslint, parseToolFile } from '#tests/setup/tool-files.ts';
import { listToolProjectPins } from '#cli/configurations/declared-tools.ts';
import { NESTED_PYTHON_SETTINGS } from '#tests/data/checks/python/project.ts';

import {
    PLAIN_TOOL_FILES,
    TOOL_FILE_PROJECT,
    IGNORED_CHECK_FILES,
    JSCONFIG_TITLE_IGNORE_PROJECT,
} from '#tests/data/generation/settings.ts';

test('a Ruff-only Python scope gets no type checker file or pointer', async () => {
    await using sandbox = await testdir({
        'gspot.toml': NESTED_PYTHON_SETTINGS,
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
        'gspot.toml': buildSandboxSettings(['typescript'], { tables: '[rules]\nenabled = false\n' }),
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
    expect(paths).toContain('.gspot/configurations/general/files/taplo.toml');
    for (const path of ['.gspot/configurations/general/format/prettier.json', '.prettierignore'])
        expect(paths).not.toContain(path);
    const packages = listToolProjectPins(session.neededToolConfigurations).npm;
    const expected = listToolProjectPins([session.configurations.get('files')!]).npm;
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
            .flatMap((scope) => scope.selected)
            .filter((configuration) => configurations.includes(configuration.name))
            .map((configuration) => configuration.name),
    );
    expect(selected).toStrictEqual(new Set(configurations));
    const paths = new Set(generated.map((file) => file.path));
    const checks = session.configuredChecks;
    const checkNames = new Set(checks.map((entry) => entry.check.name));
    const tools = new Set(checks.flatMap((entry) => listNeededTools(entry)));
    for (const { scope, selected: configurations } of session.scopes) {
        const targets = configurations
            .flatMap((configuration) => configuration.toolFiles)
            .filter((file) => file.level !== 'all' || level === 'all')
            .filter((file) => file.tool.length === 0 || file.tool.some((name) => tools.has(name)))
            .filter((file) => file.check.length === 0 || file.check.some((name) => checkNames.has(name)))
            .map((file) => buildScopeTarget(scope.path, file, getToolFiles(session).targets));
        expect(targets.length).toBeGreaterThan(0);
        expect(new Set(targets).difference(paths)).toStrictEqual(new Set<string>());
    }
    for (const file of generated) {
        if (new Set<string>(PLAIN_TOOL_FILES).has(basename(file.path))) continue;
        parseToolFile(file.content, file.path);
    }
});
test('tool file source values list the dependencies of each scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'testing-library'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['javascript', 'testing-library'] }],
        }),
        'package.json': '{"private":true,"dependencies":{"@testing-library/react":"*"}}',
        'app/package.json': '{"private":true,"dependencies":{"@testing-library/vue":"*"}}',
        'sample.test.js': 'export const value = 1;\n',
        'app/sample.test.js': 'export const value = 1;\n',
    });

    const eslint = await createEslint(sandbox.path);
    const configuration = (await eslint.calculateConfigForFile('sample.test.js')) as EslintConfiguration;
    expect(configuration.rules['testing-library/no-dom-import']).toStrictEqual([2, 'react']);
    const applicationConfiguration = (await eslint.calculateConfigForFile('app/sample.test.js')) as EslintConfiguration;
    expect(applicationConfiguration.rules['testing-library/no-dom-import']).toStrictEqual([2, 'vue']);
});

test('a jsconfig beside a tsconfig excludes build output and lists only tracked declaration files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], { tables: '[rules]\nenabled = false\n' }),
        '.gitignore': '.next/\n.open-next/\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*.ts"],"exclude":["vendor"]}',
        'src/main.ts': 'export const value = 1;\n',
        'worker.js': 'export const worker = 1;\n',
        'cloudflare-env.d.ts': 'declare const env: string;\n',
        '.next/types/routes.d.ts': 'declare const routes: string;\n',
        '.open-next/worker.js': 'export const bundle = 1;\n',
    });

    readGitOutput(sandbox.path, ['init', '-q']);
    readGitOutput(sandbox.path, [
        'add',
        '--',
        '.gitignore',
        'tsconfig.json',
        'src/main.ts',
        'worker.js',
        'cloudflare-env.d.ts',
    ]);
    const files = generate(await openSession(sandbox.path)).files;
    const jsconfig = JSON.parse(
        files.find(({ path }) => path === '.gspot/configurations/language/javascript/jsconfig.json')!.content,
    ) as { files: string[]; exclude: string[] };
    expect(jsconfig.files).toStrictEqual(['../../../../cloudflare-env.d.ts']);
    expect(jsconfig.exclude).toStrictEqual(
        matchItems(['../../../../**/.open-next/**', '../../../../**/node_modules/**', '../../../../vendor']),
    );
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
