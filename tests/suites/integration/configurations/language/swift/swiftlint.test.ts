import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import {
    CAST_SWIFT,
    CORRECTED_PARSER_SOURCE,
    PARAMETER_LIMIT_CASE,
    PARSER_SOURCE,
    SWIFT_SANDBOX,
    XCTEST_SCOPES,
} from '#tests/config/integration/swift.ts';
import { CLEAN_SWIFT } from '#tests/config/setup/languages.ts';
import { listFindingRows, parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { runCheckOnChanges } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings, prepareParameterProject } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { runBlockingCommand, runCommand } from '#tests/setup/system/processes.ts';
import type { LinterJsonFinding } from '#tests/types/integration.ts';

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
            { file: `${prefix}Sources/Value.swift`, line: 2, rule: 'no_magic_numbers' },
        ]);
        await writeFile(join(root, `${prefix}Sources/Value.swift`), CORRECTED_PARSER_SOURCE);
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

async function prepareSwiftScope(scopePath: string) {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(await createGitSandbox({}));
    const root = sandbox.path;
    const prefix = scopePath === '' ? '' : `${scopePath}/`;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(scopePath === '' ? ['swift'] : [], {
            level: 'all',
            scopes: scopePath === '' ? [] : [{ path: scopePath, configurations: ['swift'] }],
        }),
        [`${prefix}Sources/Value.swift`]: CORRECTED_PARSER_SOURCE,
        [`${prefix}AppTests/Value.swift`]: PARSER_SOURCE,
        [`${prefix}AppTests/Deep/Value.swift`]: PARSER_SOURCE,
    });
    await applyGeneratedFiles(root);
    expect(existsSync(join(root, `${prefix}AppTests/.swiftlint.yml`))).toBe(true);
    const lifetime = resources.move();
    return { root, prefix, [Symbol.asyncDispose]: lifetime[Symbol.asyncDispose].bind(lifetime) };
}

test.skipIf(!hasToolBuild('swiftlint'))('SwiftLint at the root fixes a negated flag with --fix', async () => {
    await using sandbox = await prepareSwiftScope('');
    const { root, prefix } = sandbox;
    const source = `/// Inverts a sample flag.
public func inverted(_ value: Bool) -> Bool {
    var flag = value
    flag = !flag
    return flag
}
`;
    await writeFile(join(root, `${prefix}Sources/Value.swift`), source);
    const fixed = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json', '--fix']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(root, `${prefix}Sources/Value.swift`), 'utf8')).toBe(
        source.replace('flag = !flag', 'flag.toggle()'),
    );
});

test.skipIf(!hasToolBuild('swiftlint')).each(['AppTests', 'AppTests/Helpers'])(
    'a Swift test scope %s gets one complete SwiftLint config file',
    async (scope) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], {
                level: 'all',
                scopes: [{ path: scope, configurations: ['swift'] }],
            }),
            [`${scope}/Value.swift`]: PARSER_SOURCE,
        });

        await applyGeneratedFiles(sandbox.path);
        expect(existsSync(join(sandbox.path, `${scope}/.swiftlint.yml`))).toBe(true);
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
        const { root } = installedSandbox();
        await using _change = await writeSandboxChanges(installedSandbox(), {
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
            const clean = await spawnGspot(root, ['check', '--only', id]);
            expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
        }
        const result = parseCheckReport(
            await runCheckOnChanges(installedSandbox(), {
                check: 'swift/swiftlint',
                files: { 'ios/Sources/App/Cast.swift': CAST_SWIFT },
            }),
        );
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(result.report.checks).toMatchObject([{ check: 'swift/swiftlint', scope: 'ios', status: 'failed' }]);
        expect(listFindingRows(result.report)).toStrictEqual([
            { file: 'ios/Sources/App/Cast.swift', line: 5, rule: 'force_cast' },
        ]);
        await writeFile(join(root, 'ios/Sources/App/Cast.swift'), CLEAN_SWIFT.replace('greeting', 'correctedGreeting'));
        const corrected = parseCheckReport(await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([
            { check: 'swift/swiftlint', scope: 'ios', status: 'passed', findings: [] },
        ]);
    },
);

test.skipIf(!hasToolBuild('swiftlint')).each(['default', 8] as const)(
    'SwiftLint counts parameters with maximum %p',
    async (supplied) => {
        const scenario = PARAMETER_LIMIT_CASE;
        await using sandbox = await createGitSandbox({});
        const { maximum, defaultMaximum } = await prepareParameterProject(sandbox.path, scenario, supplied);
        const result = runBlockingCommand(
            [
                'swiftlint',
                'lint',
                '--config',
                getManifestTarget('swift', 'swiftlint.yml'),
                '--reporter',
                'json',
                '--quiet',
                '--no-cache',
                scenario.file,
            ],
            { cwd: sandbox.path },
        );
        const findings = JSON.parse(result.stdout) as LinterJsonFinding[];
        expect(result.code, result.stdout + result.stderr).toBe(
            maximum === defaultMaximum ? scenario.failureStatus : 0,
        );
        expect(findings.filter((finding) => finding.rule_id === 'function_parameter_count')).toMatchObject(
            maximum === defaultMaximum ? [scenario.finding] : [],
        );
    },
);
