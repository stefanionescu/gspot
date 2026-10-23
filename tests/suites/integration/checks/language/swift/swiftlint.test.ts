import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { unlink, readFile, writeFile } from 'node:fs/promises';
import { runCheckOnChanges } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { CLEAN_SWIFT } from '#tests/config/checks/language/swift/sandbox.ts';
import { SWIFT_SANDBOX } from '#tests/config/integration/checks/language/swift/samples.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    CAST_SWIFT,
    XCTEST_SCOPES,
    PARSER_SOURCE,
    CORRECTED_PARSER_SOURCE,
} from '#tests/config/integration/checks/language/swift/swiftlint.ts';

const installedSandbox = shareInstalledSandbox(SWIFT_SANDBOX);

test.skipIf(!hasToolBuild('swiftlint')).each([...XCTEST_SCOPES])(
    'SwiftLint $name reports the source lint rules and passes after the fix',
    async ({ scope }) => {
        await using sandbox = await prepareSwiftScope(scope);
        const { root, prefix } = sandbox;
        await writeFile(join(root, `${prefix}Sources/Value.swift`), PARSER_SOURCE);
        const broken = parseCheckReport(await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(listFindingRows(broken.report)).toStrictEqual([
            { file: `${prefix}Sources/Value.swift`, line: 2, rule: 'force_unwrapping' },
            { file: `${prefix}Sources/Value.swift`, line: 1, rule: 'missing_docs' },
            { file: `${prefix}Sources/Value.swift`, line: 2, rule: 'no_magic_numbers' },
        ]);
        await writeFile(join(root, `${prefix}Sources/Value.swift`), CORRECTED_PARSER_SOURCE);
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

async function prepareSwiftScope(scope: string) {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(await testdir());
    const root = sandbox.path;
    const prefix = scope === '' ? '' : `${scope}/`;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(scope === '' ? ['swift'] : [], {
            level: 'all',
            scopes: scope === '' ? [] : [{ path: scope, configurations: ['swift'] }],
        }),
        [`${prefix}Sources/Value.swift`]: CORRECTED_PARSER_SOURCE,
        [`${prefix}AppTests/Value.swift`]: PARSER_SOURCE,
        [`${prefix}AppTests/Deep/Value.swift`]: PARSER_SOURCE,
    });
    expect(await spawnGspot(root, ['apply'])).toMatchObject({ code: 0 });
    expect(await isOnDisk(join(root, `${prefix}AppTests/.swiftlint.yml`))).toBe(true);
    const lifetime = resources.move();
    return { root, prefix, [Symbol.asyncDispose]: lifetime[Symbol.asyncDispose].bind(lifetime) };
}

test.skipIf(!hasToolBuild('swiftlint')).each([...XCTEST_SCOPES])(
    'SwiftLint $name fixes source formatting with --fix',
    async ({ scope }) => {
        await using sandbox = await prepareSwiftScope(scope);
        const { root, prefix } = sandbox;
        await writeFile(
            join(root, `${prefix}Sources/Value.swift`),
            CORRECTED_PARSER_SOURCE.replace('value: String', 'value:String'),
        );
        const fixed = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json', '--fix']);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await readFile(join(root, `${prefix}Sources/Value.swift`), 'utf8')).toBe(CORRECTED_PARSER_SOURCE);
    },
);

test.skipIf(!hasToolBuild('swiftlint')).each([...XCTEST_SCOPES])(
    'SwiftLint $name refuses a missing root config file and names its path',
    async ({ scope }) => {
        await using sandbox = await prepareSwiftScope(scope);
        const { root, prefix } = sandbox;
        const path = join(root, `${prefix}.swiftlint.yml`);
        await unlink(path);
        const missing = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']);
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect(parseCheckReport(missing).report.checks).toMatchObject([
            {
                check: 'swift/swiftlint',
                status: 'error',
                findings: [],
                note: `The config file ${prefix}.swiftlint.yml is missing. Run gspot apply.`,
            },
        ]);
    },
);

test.skipIf(!hasToolBuild('swiftlint')).each(['AppTests', 'AppTests/Helpers'])(
    'a Swift test scope %s gets one complete SwiftLint config file',
    async (scope) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], {
                level: 'all',
                scopes: [{ path: scope, configurations: ['swift'] }],
            }),
            [`${scope}/Value.swift`]: PARSER_SOURCE,
        });

        expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
        expect(await isOnDisk(join(sandbox.path, `${scope}/.swiftlint.yml`))).toBe(true);
        const toolResult = await runCommand(
            ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
            { cwd: join(sandbox.path, scope) },
        );
        expect(toolResult.code, toolResult.stdout + toolResult.stderr).toBe(0);
        expect(JSON.parse(toolResult.stdout)).toStrictEqual([]);
        const result = await spawnGspot(sandbox.path, ['check', '--only', 'swift/swiftlint', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    },
);

test.skipIf(!hasToolBuild('swiftlint'))(
    'SwiftLint and SwiftFormat read the configuration of their scope, and the findings keep the scope path',
    async () => {
        const { root, environment } = installedSandbox();
        await using _change = await applySandboxChanges(installedSandbox(), {
            check: 'swift/swiftlint',
            removed: Object.keys(SWIFT_SANDBOX.files),
            files: {
                'ios/Sources/App/Greeting.swift': CLEAN_SWIFT,
                'README.md': '# test\n',
                'ios/Sources/App/Cast.swift': '',
                'gspot.toml': buildSandboxSettings([], {
                    level: 'all',
                    scopes: [{ path: 'ios', configurations: ['swift'] }],
                }),
            },
        });

        for (const id of ['swift/swiftlint', 'swift/swiftformat']) {
            const clean = await spawnGspot(root, ['check', '--only', id], environment);
            expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
        }
        const result = parseCheckReport(
            await runCheckOnChanges(
                root,
                { check: 'swift/swiftlint', files: { 'ios/Sources/App/Cast.swift': CAST_SWIFT } },
                environment,
            ),
        );
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(result.report.checks).toMatchObject([{ check: 'swift/swiftlint', scope: 'ios', status: 'failed' }]);
        expect(listFindingRows(result.report)).toStrictEqual([
            { file: 'ios/Sources/App/Cast.swift', line: 5, rule: 'force_cast' },
        ]);
        await writeFile(join(root, 'ios/Sources/App/Cast.swift'), CLEAN_SWIFT.replace('greeting', 'correctedGreeting'));
        const corrected = parseCheckReport(
            await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json'], environment),
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([
            { check: 'swift/swiftlint', scope: 'ios', status: 'passed', findings: [] },
        ]);
    },
);
