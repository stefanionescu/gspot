// The swift configuration over a package: the build, the analyzer, and Periphery report their planted defects.
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import type { Finding } from '#cli/checks/result.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { SWIFT_INIT } from '#tests/support/cli/swift-fixtures.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/support/cli/command.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';

const PACKAGE =
    '// swift-tools-version:5.9\nimport PackageDescription\n\nlet package = Package(\n    name: "App",\n    products: [.library(name: "App", targets: ["App"])],\n    targets: [.target(name: "App")]\n)\n';
const LIBRARY =
    '/// Builds the greeting for a person.\npublic func greeting(for name: String) -> String {\n    "hello \\(name)"\n}\n';
const BUILD_CASES: FindingCase[] = [
    {
        check: 'swift/build',
        files: { 'Sources/App/Count.swift': '/// A number that holds text.\npublic let count: Int = "three"\n' },
        expected: { file: 'Sources/App/Count.swift', rule: 'compiler', line: 2 },
    },
    {
        check: 'swift/swiftlint-analyze',
        files: {
            'Sources/App/Pair.swift':
                'import Foundation\n\n/// The size of a pair.\npublic func pairSize(of count: Int) -> Int {\n    count * 2\n}\n',
        },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused_import', line: 1 },
    },
    {
        check: 'swift/periphery',
        files: {
            'Sources/App/Pair.swift':
                '/// The size of a pair.\npublic func pairSize(of count: Int) -> Int {\n    count * 2\n}\n\nprivate func neverCalled() -> Int {\n    count(of: 3)\n}\n\nprivate func count(of size: Int) -> Int {\n    size\n}\n',
        },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused', line: 6 },
    },
];

describe('the swift configuration over a package', () => {
    test.each(BUILD_CASES)(
        '$check reports $expected.rule in the Swift package and accepts corrected source',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                '.gitignore': '.build\n',
                'Package.swift': PACKAGE,
                'Sources/App/Greeting.swift': LIBRARY,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'periphery', 'typos', 'ec']) };
            await installAtLevel(sandbox.path, SWIFT_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            // The Swift toolchain checks run on macOS alone; elsewhere they are skipped and the run passes.
            const isSkipped = process.platform !== 'darwin';
            const withExpected: Finding[] = containingAll([containing(planted.expected)]);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(isSkipped ? 0 : 1);
            expect(failed.checks).toMatchObject([{ check: planted.check, status: isSkipped ? 'skipped' : 'fail' }]);
            expect(failed.checks[0]!.findings).toStrictEqual(isSkipped ? [] : withExpected);
            const path = planted.expected.file;
            const text = planted.files[path]!;
            const correctedText =
                planted.check === 'swift/build'
                    ? text.replace('"three"', '3')
                    : planted.check === 'swift/swiftlint-analyze'
                      ? text.replace('import Foundation\n\n', '')
                      : text.slice(0, text.indexOf('private func'));
            const corrected = await runPlanted(
                sandbox.path,
                { ...planted, files: { [path]: correctedText } },
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([
                { check: planted.check, status: isSkipped ? 'skipped' : 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 10,
    );
});
