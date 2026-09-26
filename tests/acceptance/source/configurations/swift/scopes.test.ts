// The swift configuration inside a scope: the tools read the scope's configuration and findings carry its path.
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
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
            await install(sandbox.path, argv, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            for (const id of ['swift/swiftlint', 'swift/swiftformat']) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            const outcome = await runPlanted(
                sandbox.path,
                { check: 'swift/swiftlint', files: { 'ios/Sources/App/Cast.swift': CAST_SWIFT } },
                environment,
            );
            if (process.platform === 'win32') {
                expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                expect(outcome.stdout).toContain('swiftlint has no Windows build');
            } else {
                expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
                const failed = reportSchema.parse(
                    await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
                );
                expect(failed.checks).toMatchObject([{ check: 'swift/swiftlint', scope: 'ios', status: 'fail' }]);
                expect(failed.checks[0]!.findings).toContainEqual(
                    expect.objectContaining({ file: 'ios/Sources/App/Cast.swift', rule: 'force_cast', line: 5 }),
                );
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
                    { check: 'swift/swiftlint', scope: 'ios', status: 'ok', findings: [] },
                ]);
            }
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
