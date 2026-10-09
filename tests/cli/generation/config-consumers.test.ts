// A tool config and its pointer exist only where an enabled check consumes the tool.
import { parse } from 'yaml';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { npmPins, toolPin } from '#cli/configurations/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { configuredChecks, applicableManifests } from '#cli/planning/public.ts';
import type { StylelintConfiguration } from '#tests/types/cli/generation/configuration-files.ts';

import {
    EDITORCONFIG_POLICY,
    STYLELINT_CONSUMERS,
    SWIFT_FORMAT_POLICY,
    NESTED_PYTHON_POLICY,
    STYLELINT_SCOPE_FILES,
    STYLELINT_SCOPE_TABLES,
} from '#tests/config/cli/generation/config-consumers.ts';

test('a sibling type checker does not generate its config or pointer in a Ruff-only Python scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': NESTED_PYTHON_POLICY,
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

test('TypeScript-only input activates Knip and does not generate an unused JavaScript compiler config', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["typescript"]\n[agent_rules]\nenabled = false\n',
        'src/main.ts': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const paths = emitAll(session).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/tsconfig.json');
    expect(paths).toContain('.gspot/config/knip.json');
    expect(paths).not.toContain('.gspot/config/jsconfig.json');
    expect(configuredChecks(session).map((check) => check.check.name)).toContain('javascript/knip');
});

test('ignoring SwiftLint and Periphery retains SwiftFormat without their config files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SWIFT_FORMAT_POLICY,
        'main.swift': 'let value = 1\n',
    });
    const paths = emitAll(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/swiftformat');
    expect(paths).not.toContain('.gspot/config/swiftlint.yml');
    expect(paths).not.toContain('.gspot/config/periphery.yml');
    expect(paths).not.toContain('.gspot/package.json');
});

test('EditorConfig can remain active without generating a Prettier config or ignore file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': EDITORCONFIG_POLICY,
        'sample.json': '{"value":1}\n',
    });
    const paths = emitAll(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.editorconfig');
    expect(paths).not.toContain('.gspot/config/prettier.json');
    expect(paths).not.toContain('.prettierignore');
});

test.each(STYLELINT_CONSUMERS)('$name installs the HTML parser only for consumed framework styles', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(entry.configurations, { tables: '[agent_rules]\nenabled = false\n' }),
        ...entry.files,
    });
    const session = await openSession(sandbox.path);
    const packages = npmPins(applicableManifests(session), undefined);
    expect(packages['postcss-html']).toBe(
        entry.needsHtmlParser ? toolPin(configurationManifests().values(), 'postcss-html').version : undefined,
    );
    const stylelint = configuredChecks(session).find((check) => check.check.name === 'css/stylelint');
    expect(stylelint !== undefined).toBe(entry.configurations.includes('css'));
});

test.each(['recommended', 'all'] as const)(
    '%s keeps framework stylesheet dialects inside their scopes',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['css'], { level, tables: STYLELINT_SCOPE_TABLES }),
            ...STYLELINT_SCOPE_FILES,
        });
        const outputs = emitAll(await openSession(sandbox.path)).files;
        const documents = Object.fromEntries(
            ['', 'vue', 'svelte', 'mixed'].map((scope) => {
                const prefix = scope === '' ? '' : `${scope}/`;
                const output = outputs.find((file) => file.path === `.gspot/config/${prefix}stylelint.json`)!;
                return [scope, JSON.parse(output.content) as StylelintConfiguration];
            }),
        );
        expect(documents['']!.overrides).toStrictEqual([]);
        expect(documents['']!.rules['function-no-unknown']).toBe(true);
        expect(documents['']!.rules['declaration-property-value-no-unknown']).toBe(true);
        expect(documents['vue']!.rules['function-no-unknown']).toStrictEqual([true, { ignoreFunctions: ['theme'] }]);
        expect(documents['vue']!.rules['declaration-property-value-no-unknown']).toStrictEqual([
            true,
            { ignoreProperties: { '/.*/': [String.raw`/\btheme\(/`] } },
        ]);
        expect(documents['vue']!.overrides).toStrictEqual([
            {
                files: ['**/*.vue'],
                customSyntax: 'postcss-html',
                rules: {
                    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['deep', 'global', 'slotted'] }],
                    'function-no-unknown': [true, { ignoreFunctions: ['v-bind', 'theme'] }],
                    'value-keyword-case': ['lower', { ignoreFunctions: ['v-bind'] }],
                    'declaration-property-value-no-unknown': [
                        true,
                        { ignoreProperties: { '/.*/': [String.raw`/\bv-bind\(/`, String.raw`/\btheme\(/`] } },
                    ],
                },
            },
        ]);
        expect(documents['svelte']!.rules['function-no-unknown']).toBe(true);
        expect(documents['svelte']!.overrides).toStrictEqual([
            {
                files: ['**/*.svelte'],
                customSyntax: 'postcss-html',
                rules: {
                    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
                },
            },
        ]);
        expect(documents['mixed']!.overrides.map((override) => override.files)).toStrictEqual([
            ['**/*.vue'],
            ['**/*.svelte'],
        ]);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s generates only consumed formatter assets and tools for Go and Rust sources',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], { level, tables: '[agent_rules]\nenabled = false\n' }),
            'main.go': 'package main\nfunc main() {}\n',
            'main.rs': 'fn main() {}\n',
        });
        const session = await openSession(sandbox.path);
        const files = emitAll(session).files;
        const paths = files.map((file) => file.path);
        expect(paths).toContain('.editorconfig');
        expect(paths).toContain('.gspot/config/taplo.toml');
        for (const path of ['.gspot/config/prettier.json', '.prettierrc.json', '.prettierignore'])
            expect(paths).not.toContain(path);
        const packages = npmPins(applicableManifests(session), undefined);
        const manifests = configurationManifests();
        const fileManifest = manifests.get('files')!;
        const expected = npmPins(
            [{ ...fileManifest, tools: [...fileManifest.tools, toolPin(manifests.values(), 'editorconfig-checker')] }],
            undefined,
        );
        expect(Object.keys(packages).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(Object.keys(expected));
        expect(configuredChecks(session).map((check) => check.check.name)).not.toContain('format/prettier');
    },
);

test.each(
    (['recommended', 'all'] as const).flatMap((level) => [
        ...(['mise', 'npm', 'bun', 'pnpm', 'yarn'] as const).map((runner) => ({ level, runner, hasSchemas: true })),
        { level, runner: undefined, hasSchemas: false },
        { level, runner: 'npm' as const, hasSchemas: false },
    ]),
)(
    '$runner catalog at $level with custom schemas=$hasSchemas stays native and includes mise only for its runner',
    async ({ runner, level, hasSchemas }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                configurations: ['files'],
                level,
                ...(runner === undefined ? {} : { runner }),
                tools: { v8r: { schemas: hasSchemas ? { 'custom.json': 'https://example.com/schema.json' } : {} } },
            }),
            'custom.json': '{}\n',
        });
        const output = emitAll(await openSession(sandbox.path));
        const text = output.files.find((file) => file.path === '.gspot/config/v8r.yml')!.content;
        const native: unknown = parse(text);
        const schemas: unknown = hasSchemas
            ? expect.arrayContaining([
                  { name: 'custom.json', fileMatch: ['custom.json'], location: 'https://example.com/schema.json' },
              ])
            : [];
        expect(native).toMatchObject({ customCatalog: { schemas } });
        expect(text.includes('name: mise')).toBe(runner === 'mise');
    },
);

test.each(['recommended', 'all'] as const)(
    '%s selects gspot in root and child structure scopes without a redundant dependency',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['structure'], { level, tables: '[scope.child]\n' }),
            'source.txt': 'Source\n',
            'child/source.txt': 'Child source\n',
        });
        const session = await openSession(sandbox.path);
        for (const scope of ['', 'child']) {
            const selected = session.scopes.find((entry) => entry.scope.path === scope)!.view.configurations;
            expect(selected).toContain('structure');
            expect(selected).toContain('gspot');
        }
    },
);
