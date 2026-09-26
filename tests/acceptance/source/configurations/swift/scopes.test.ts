// The swift configuration inside a scope: the tools read the scope's configuration and findings carry its path.
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import type { Finding } from '#cli/types/checks/checks.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';
import { CAST_SWIFT, CLEAN_SWIFT } from '#tests/support/cli/swift-fixtures.ts';

describe('the swift configuration inside a scope', () => {
    test(
        'SwiftLint and SwiftFormat read the configuration of their scope, and the findings carry the scope path',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'ios/Sources/App/Greeting.swift': CLEAN_SWIFT,
                'README.md': '# planted\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            const argv = [
                'init',
                '--yes',
                '--scope',
                'ios=swift',
                '--without',
                'spelling',
                'naming',
                'markdown',
                'docs',
                '--no-runner',
                '--no-ci',
                '--no-hooks',
                '--no-rules',
                '--no-install',
            ];
            await installAtLevel(sandbox.path, argv, environment);
            for (const id of ['swift/swiftlint', 'swift/swiftformat']) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            const outcome = await runPlanted(
                sandbox.path,
                { check: 'swift/swiftlint', files: { 'ios/Sources/App/Cast.swift': CAST_SWIFT } },
                environment,
            );
            // SwiftLint has no Windows build, so the check is skipped there with a note and the run passes.
            const isWindows = process.platform === 'win32';
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(isWindows ? 0 : 1);
            expect(outcome.stdout.includes('swiftlint has no Windows build')).toBe(isWindows);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([
                { check: 'swift/swiftlint', scope: 'ios', status: isWindows ? 'skipped' : 'fail' },
            ]);
            const cast: Finding = containing({ file: 'ios/Sources/App/Cast.swift', rule: 'force_cast', line: 5 });
            const withCast: Finding[] = containingAll([cast]);
            expect(failed.checks[0]!.findings).toStrictEqual(isWindows ? [] : withCast);
            await Bun.write(
                join(sandbox.path, 'ios/Sources/App/Cast.swift'),
                CLEAN_SWIFT.replace('greeting', 'correctedGreeting'),
            );
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'swift/swiftlint', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: 'swift/swiftlint', scope: 'ios', status: isWindows ? 'skipped' : 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
