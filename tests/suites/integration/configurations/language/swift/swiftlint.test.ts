import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
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
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { runBlockingCommand, runCommand } from '#tests/setup/system/processes.ts';
import type { LinterJsonFinding } from '#tests/types/integration.ts';

const BRANCHING_SOURCE = `/// Counts the matches of a sample value.
public func matches(_ value: Int) -> Int {
    var total = 0
    if value == 1 { total += 1 }
    if value == 2 { total += 1 }
    if value == 3 { total += 1 }
    return total
}
`;

const REASON = 'The generated parser keeps its long lines.';

const installedSandbox = shareInstalledSandbox(SWIFT_SANDBOX);

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
    const lifetime = resources.move();
    return { root, prefix, [Symbol.asyncDispose]: lifetime[Symbol.asyncDispose].bind(lifetime) };
}

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

const PARAMETER_LIMITS = [
    { limit: 7, code: PARAMETER_LIMIT_CASE.failureStatus, findings: [PARAMETER_LIMIT_CASE.finding] },
    { limit: 8, code: 0, findings: [] },
] as const;

test.skipIf(!hasToolBuild('swiftlint')).each([...PARAMETER_LIMITS])(
    'SwiftLint with max_function_parameters $limit reports a function of eight parameters only past the limit',
    async ({ limit, code, findings: expected }) => {
        const scenario = PARAMETER_LIMIT_CASE;
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift'], {
                level: 'all',
                tables: `[limits.swift]\nmax_function_parameters = { value = ${String(limit)}, reason = "The project API declares its required parameters." }\n`,
            }),
            [scenario.file]: scenario.source,
        });
        await applyGeneratedFiles(sandbox.path);
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
        expect(result.code, result.stdout + result.stderr).toBe(code);
        expect(findings.filter((finding) => finding.rule_id === 'function_parameter_count')).toMatchObject([
            ...expected,
        ]);
    },
);

const COMPLEXITY_LEVELS = [
    {
        level: 'all',
        findings: [{ line: 2, reason: 'Function should have complexity 2 or less; currently complexity is 3' }],
    },
    { level: 'basic', findings: [] },
] as const;

test.skipIf(!hasToolBuild('swiftlint')).each([...COMPLEXITY_LEVELS])(
    'SwiftLint at level $level takes every generated rule name, and level all applies the complexity limit',
    async ({ level, findings: expected }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift'], {
                level,
                tables: '[limits.swift]\nmax_cyclomatic_complexity = 2\n',
            }),
            'Value.swift': BRANCHING_SOURCE,
        });
        await applyGeneratedFiles(sandbox.path);
        const result = await runCommand(
            ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
            { cwd: sandbox.path },
        );
        expect(result.stderr).toBe('');
        const findings = JSON.parse(result.stdout) as LinterJsonFinding[];
        expect(findings.filter((finding) => finding.rule_id === 'cyclomatic_complexity')).toMatchObject([...expected]);
    },
);

test.skipIf(!hasToolBuild('swiftlint'))(
    'gspot explain and ignore read a rule from the installed SwiftLint',
    async () => {
        await using sandbox = await prepareSwiftScope('');
        const { root } = sandbox;
        const explained = await spawnGspot(root, ['explain', 'swift/swiftlint', 'line_length', '--json']);
        expect(explained.code, explained.stdout + explained.stderr).toBe(0);
        expect(JSON.parse(explained.stdout)).toMatchObject({
            description: expect.stringContaining('(line_length)') as string,
        });
        const unknown = await spawnGspot(root, ['explain', 'swift/swiftlint', 'no_such_rule', '--json']);
        expect(unknown.code).toBe(2);
        expect(JSON.parse(unknown.stdout)).toMatchObject({ error: 'arguments' });
        const refused = await spawnGspot(root, [
            'ignore',
            'swift/swiftlint',
            '--rule',
            'no_such_rule',
            '--reason',
            REASON,
            '--json',
        ]);
        expect(refused.code).toBe(2);
        expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'arguments' });
        const ignored = await spawnGspot(root, [
            'ignore',
            'swift/swiftlint',
            '--rule',
            'line_length',
            '--reason',
            REASON,
        ]);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        const settings = parse(await readFile(join(root, 'gspot.toml'), 'utf8')) as { ignore?: unknown };
        expect(settings.ignore).toStrictEqual([{ check: 'swift/swiftlint', rule: 'line_length', reason: REASON }]);
    },
);
