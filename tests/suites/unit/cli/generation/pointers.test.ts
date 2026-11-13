import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';
import { parse } from 'yaml';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildPointerFiles } from '#cli/generation/pointers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { SourcedConfig } from '#cli/types/configurations/shared.ts';
import {
    DEFAULT_EXPORT,
    MARKDOWNLINT_SCOPE_TABLES,
    XCTEST_LINK_FILE_CASES,
} from '#tests/config/generation/generate.ts';
import { XCTEST_SOURCE } from '#tests/config/setup/languages.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test.each([...XCTEST_LINK_FILE_CASES])(
    'XCTest folder pointer files keep their SwiftLint overrides in scope "$scope"',
    async ({ scope, pointers }) => {
        await using sandbox = await createGitSandbox({});
        const prefix = scope === '' ? '' : `${scope}/`;
        const folder = scope.startsWith('AppTests') ? scope : `${prefix}AppTests`;
        const child = `${prefix}ChildTests`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(scope === '' ? ['swift'] : [], {
                level: 'all',
                scopes: [
                    ...(scope === '' ? [] : [{ path: scope, configurations: ['swift'] }]),
                    { path: child, configurations: ['swift'] },
                ],
                tables: '[[scope]]\npath = "omitted"\nremoved_configurations = { swift = "This scope does not use Swift or its generated pointer files." }\n',
            }),
            [`${folder}/Value.swift`]: XCTEST_SOURCE,
            [`${folder}/Deep/Value.swift`]: XCTEST_SOURCE,
            'omitted/AppTests/Value.swift': XCTEST_SOURCE,
            [`${child}/Value.swift`]: XCTEST_SOURCE,
        });
        const written = buildGeneratedFiles(await openSession(sandbox.path)).files.filter(({ path }) =>
            path.endsWith('.swiftlint.yml'),
        );
        const parsed = written.map(({ path, content }) => {
            const pointer = parse(content) as Record<string, unknown>;
            return [path, { parent: pointer['parent_config'], overrides: 'disabled_rules' in pointer }];
        });
        expect(Object.fromEntries(parsed)).toStrictEqual(pointers);
    },
);

test('JavaScript pointer files import modules from folders with URI characters and Unicode', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['javascript']) });

    const session = await openSession(sandbox.path);
    const configuration = readConfigurations().get('javascript')!;
    const config = configuration.configs
        .filter((file): file is SourcedConfig => file.source !== undefined)
        .find((file) => file.pointer?.body.includes('{target_module}') === true)!;
    const components = ['100%', '#fragment', '?query', "author's", 'café'].filter(
        (component) => !isWindows || !component.includes('?'),
    );
    const paths = [];
    for (const [index, component] of components.entries()) {
        const target = `generated/${component}/owner.mjs`;
        const [output] = buildPointerFiles(
            {
                session,
                configuration,
                scope: session.scopes[0]!,
            },
            { ...config, pointer: { ...config.pointer!, path: `entry-${String(index)}.mjs` } },
            new Map([['', target]]),
        );
        await createFileTree(sandbox.path, {
            [target]: `export default ${JSON.stringify(DEFAULT_EXPORT)};\n`,
            [output!.path]: output!.content,
        });
        paths.push(pathToFileURL(join(sandbox.path, output!.path)).href);
    }
    const toolResult = await runCommand(['node', ...buildProgramCommand('processes/modules', ...paths).slice(1)], {
        cwd: sandbox.path,
    });
    expect(toolResult.code, toolResult.stderr).toBe(0);
    expect(JSON.parse(toolResult.stdout)).toStrictEqual(components.map(() => DEFAULT_EXPORT));
});

test('a scope gets its own markdownlint pointer file only when its rules differ from the root', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { tables: MARKDOWNLINT_SCOPE_TABLES }),
        'README.md': '# Root\n',
        'same/README.md': '# Same\n',
        'other/README.md': '# Other\n',
    });

    const paths = buildGeneratedFiles(await openSession(sandbox.path)).files.map(({ path }) => path);

    expect(paths.filter((path) => path.endsWith('.markdownlint.jsonc'))).toStrictEqual([
        '.markdownlint.jsonc',
        'other/.markdownlint.jsonc',
    ]);
});

test('one root Stylelint pointer file extends the config of each scope for its files, parents first', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            scopes: [
                { path: 'web [old]', configurations: ['css'] },
                { path: 'app', configurations: ['css'] },
                { path: 'app/child', configurations: ['css'] },
            ],
        }),
        'app/style.css': 'a { color: red; }\n',
        'app/child/style.css': 'a { color: red; }\n',
        'web [old]/style.css': 'a { color: red; }\n',
    });

    const outside = buildGeneratedFiles(await openSession(sandbox.path)).files.filter(
        ({ path }) => !path.startsWith('.gspot/'),
    );

    const pointers = outside.filter(({ path }) => path.endsWith('.stylelintrc.yml'));
    expect(pointers.map(({ path }) => path)).toStrictEqual(['.stylelintrc.yml']);
    const target = `./${getManifestTarget('css', 'stylelint.json')}`;
    expect(parse(pointers[0]?.content ?? '')).toStrictEqual({
        rules: {},
        overrides: [
            { files: ['app/**'], extends: target },
            { files: ['app/child/**'], extends: target },
            { files: [String.raw`web \[old\]/**`], extends: target },
        ],
    });
});
