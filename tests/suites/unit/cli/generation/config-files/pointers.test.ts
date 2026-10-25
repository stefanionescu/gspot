import { parse } from 'yaml';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramArguments } from '#tests/setup/system/programs.ts';
import { GENERATED_HEADER_TEXT } from '#cli/config/generation/header.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildPointerFiles } from '#cli/generation/config-files/pointers.ts';

import {
    MODULE_VALUE,
    XCTEST_POINTER_CASES,
    MARKDOWNLINT_SCOPE_TABLES,
} from '#tests/config/generation/config-files/pointers.ts';

test.each([...XCTEST_POINTER_CASES])(
    'XCTest folder pointers keep their SwiftLint overrides in scope "$scope"',
    async ({ scope, pointers }) => {
        await using sandbox = await testdir();
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
                tables: '[[scope]]\npath = "omitted"\nremoved_configurations = { value = ["swift"], reason = "This scope does not use Swift or its generated pointers." }\n',
            }),
            [`${folder}/Value.swift`]: 'import XCTest\n',
            [`${folder}/Deep/Value.swift`]: 'import XCTest\n',
            'omitted/AppTests/Value.swift': 'import XCTest\n',
            [`${child}/Value.swift`]: 'import XCTest\n',
        });
        const written = generate(await openSession(sandbox.path)).files.filter(({ path }) =>
            path.endsWith('.swiftlint.yml'),
        );
        expect(Object.fromEntries(written.map(({ path, content }) => [path, parse(content) as unknown]))).toStrictEqual(
            pointers,
        );
        for (const { content } of written) expect(content).toStartWith(`# ${GENERATED_HEADER_TEXT}\n`);
    },
);

test('JavaScript pointers import modules from folders with URI characters and Unicode', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['javascript']) });

    const session = await openSession(sandbox.path);
    const configuration = session.configurationsByName.get('javascript')!;
    const configFile = configuration.configFiles
        .filter((file) => file.source !== undefined)
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
            { ...configFile, pointer: { ...configFile.pointer!, path: `entry-${String(index)}.mjs` } },
            target,
        );
        await createFileTree(sandbox.path, {
            [target]: `export default ${JSON.stringify(MODULE_VALUE)};\n`,
            [output!.path]: output!.content,
        });
        paths.push(pathToFileURL(join(sandbox.path, output!.path)).href);
    }
    const toolResult = await runCommand(['node', ...buildProgramArguments('processes/modules', ...paths)], {
        cwd: sandbox.path,
    });
    expect(toolResult.code, toolResult.stderr).toBe(0);
    expect(JSON.parse(toolResult.stdout)).toStrictEqual(components.map(() => MODULE_VALUE));
});

test('a scope gets its own markdownlint pointer only when its rules differ from the root', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['markdown'], { tables: MARKDOWNLINT_SCOPE_TABLES }),
        'README.md': '# Root\n',
        'same/README.md': '# Same\n',
        'other/README.md': '# Other\n',
    });

    const paths = generate(await openSession(sandbox.path)).files.map(({ path }) => path);

    expect(paths.filter((path) => path.endsWith('.markdownlint.jsonc'))).toStrictEqual([
        '.markdownlint.jsonc',
        'other/.markdownlint.jsonc',
    ]);
});

test('every generated file outside .gspot starts with the gspot header, and the Stylelint pointer is YAML', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript', 'css', 'markdown', 'python'], { level: 'all' }),
        'package.json': '{"private":true}\n',
    });
    const outside = generate(await openSession(sandbox.path)).files.filter(({ path }) => !path.startsWith('.gspot/'));
    const paths = outside.map(({ path }) => path);
    expect(paths).toContain('.stylelintrc.yml');
    expect(paths).toContain('pyrightconfig.json');
    for (const { content } of outside) expect(content.split('\n', 1)[0]).toEndWith(GENERATED_HEADER_TEXT);
    const stylelint = outside.find(({ path }) => path === '.stylelintrc.yml');
    expect(parse(stylelint?.content ?? '')).toStrictEqual({
        extends: `./${findManifestTarget('css', 'stylelint.json')}`,
    });
});
