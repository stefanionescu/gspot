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
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { GENERATED_HEADER_TEXT } from '#cli/config/generation/header.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildPointerFiles } from '#cli/generation/config-files/pointers.ts';

import {
    MODULE_PATHS,
    MODULE_VALUE,
    OMITTED_SWIFT_SCOPE,
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
                tables: OMITTED_SWIFT_SCOPE,
            }),
            [`${folder}/Value.swift`]: 'import XCTest\n',
            [`${folder}/Deep/Value.swift`]: 'import XCTest\n',
            'omitted/AppTests/Value.swift': 'import XCTest\n',
            [`${child}/Value.swift`]: 'import XCTest\n',
        });
        const written = generate(await openSession(sandbox.path)).files.filter(({ path }) =>
            path.endsWith('.swiftlint.yml'),
        );
        const config = findManifestTarget('swift', 'swiftlint.yml');
        const testsPointer = readConfigurations()
            .get('swift')!
            .configFiles.find(({ pointer }) => pointer?.folders !== undefined)!.pointer!;
        expect(Object.fromEntries(written.map(({ path, content }) => [path, parse(content) as unknown]))).toStrictEqual(
            Object.fromEntries(
                pointers.map(([path, climb, inTests]) => [
                    path,
                    inTests
                        ? (parse(
                              testsPointer.body.replace('{target_json}', JSON.stringify(`${climb}${config}`)),
                          ) as unknown)
                        : { parent_config: `${climb}${config}` },
                ]),
            ),
        );
        for (const { content } of written) expect(content).toStartWith(`# ${GENERATED_HEADER_TEXT}\n`);
    },
);

test('JavaScript pointers import modules from folders with URI characters and Unicode', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['javascript']) });

    const session = await openSession(sandbox.path);
    const configuration = session.configurations.get('javascript')!;
    const configFile = configuration.configFiles
        .filter((file) => file.source !== undefined)
        .find((file) => file.pointer?.body.includes('{target_module}') === true)!;
    const components = MODULE_PATHS.filter((component) => !isWindows || !component.includes('?'));
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
    const toolResult = await runCommand(
        [
            'node',
            '-e',
            'process.stdout.write(JSON.stringify(await Promise.all(process.argv.slice(1).map(async (path) => (await import(path)).default))));',
            ...paths,
        ],
        { cwd: sandbox.path },
    );
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
