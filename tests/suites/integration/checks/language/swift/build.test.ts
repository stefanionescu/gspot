import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname, basename } from 'node:path';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { redirectCacheFolder } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { isMacos, hasToolBuild } from '#tests/setup/system/platform.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { SWIFT_LANGUAGE_PACKAGE } from '#tests/config/checks/language/swift/build.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    XCODE_TOOL_SCHEME,
    SWIFT_VALUE_ERROR,
    XCODE_BUILD_TABLES,
    XCODE_TOOL_PROJECT,
    SWIFT_VALUE_SOURCE,
    SWIFT_PACKAGE_CASES,
    SWIFT_PACKAGE_SANDBOX,
} from '#tests/config/integration/checks/language/swift/build.ts';

test.skipIf(!isMacos)('swift/build reuses its compiled objects and still reports a changed source', async () => {
    await using sandbox = await testdir();
    await using _cache = await redirectCacheFolder();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift']),
        'Package.swift': SWIFT_LANGUAGE_PACKAGE,
        'Sources/Example/Value.swift': SWIFT_VALUE_SOURCE,
    });
    const command = ['check', '--only', 'swift/build', '--json'];
    const first = await runGspot(sandbox.path, command);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const files = await Array.fromAsync(new Bun.Glob('**/Value.swift.o').scan({ cwd: readCacheFolder() }));
    expect(files).toHaveLength(1);
    const compiledFile = join(readCacheFolder(), files[0]!);
    const { mtimeMs: modified } = await stat(compiledFile);
    const again = await runGspot(sandbox.path, command);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    expect(await stat(compiledFile)).toMatchObject({ mtimeMs: modified });
    await writeFile(join(sandbox.path, 'Sources/Example/Value.swift'), SWIFT_VALUE_ERROR);
    const failedBuild = parseCheckReport(await runGspot(sandbox.path, command));
    expect(failedBuild.code, failedBuild.stdout + failedBuild.stderr).toBe(1);
    expect(failedBuild.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'Sources/Example/Value.swift', line: 1, rule: 'compiler' },
    ]);
    await writeFile(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = 2\n');
    const repairedBuild = parseCheckReport(await runGspot(sandbox.path, command));
    expect(repairedBuild.code, repairedBuild.stdout + repairedBuild.stderr).toBe(0);
    expect(repairedBuild.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test.skipIf(!isMacos)(
    'swift/build reuses the compiled objects of an Xcode project and reports source errors without changing the project',
    async () => {
        await using sandbox = await testdir();
        await using _cache = await redirectCacheFolder();
        const source = 'let value: Int = 1\nprint(value)\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], { tables: XCODE_BUILD_TABLES }),
            'Example.xcodeproj/project.pbxproj': XCODE_TOOL_PROJECT,
            'Example.xcodeproj/xcshareddata/xcschemes/Example.xcscheme': XCODE_TOOL_SCHEME,
            'main.swift': source,
            'untracked.txt': 'authored content\n',
        });
        const command = ['check', '--only', 'swift/build', '--json'];
        const first = await runGspot(sandbox.path, command);
        expect(first.code, first.stdout + first.stderr).toBe(0);
        const compiledFiles = await Array.fromAsync(new Bun.Glob('**/main.o').scan({ cwd: readCacheFolder() }));
        expect(
            compiledFiles.map((file) => basename(dirname(file))).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['arm64', 'x86_64']);
        const times = await Promise.all(
            compiledFiles.map((file) => stat(join(readCacheFolder(), file)).then(({ mtimeMs }) => mtimeMs)),
        );
        const unchangedBuild = parseCheckReport(await runGspot(sandbox.path, command));
        expect(unchangedBuild.code, unchangedBuild.stdout + unchangedBuild.stderr).toBe(0);
        expect(unchangedBuild.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
        expect(
            await Promise.all(
                compiledFiles.map((file) => stat(join(readCacheFolder(), file)).then(({ mtimeMs }) => mtimeMs)),
            ),
        ).toStrictEqual(times);
        expect(await readFile(join(sandbox.path, 'main.swift'), 'utf8')).toBe(source);
        expect(await readFile(join(sandbox.path, 'Example.xcodeproj/project.pbxproj'), 'utf8')).toBe(
            XCODE_TOOL_PROJECT,
        );
        expect(await readFile(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe('authored content\n');
        expect(await isOnDisk(join(sandbox.path, 'build'))).toBe(false);
        await writeFile(join(sandbox.path, 'main.swift'), 'let value: Int = "wrong"\nprint(value)\n');
        const changedBuild = parseCheckReport(await runGspot(sandbox.path, command));
        expect(changedBuild.code, changedBuild.stdout + changedBuild.stderr).toBe(1);
        expect(changedBuild.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'main.swift', line: 1, column: 18, rule: 'compiler' },
        ]);
        await writeFile(join(sandbox.path, 'main.swift'), source);
        const restoredBuild = parseCheckReport(await runGspot(sandbox.path, command));
        expect(restoredBuild.code, restoredBuild.stdout + restoredBuild.stderr).toBe(0);
        expect(restoredBuild.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
    },
);

describe.skipIf(!isMacos)('Swift package samples', () => {
    const installedSandbox = shareInstalledSandbox(SWIFT_PACKAGE_SANDBOX);

    for (const sample of SWIFT_PACKAGE_CASES) {
        test.skipIf(!hasToolBuild(sample.check === 'swift/swiftlint-analyze' ? 'swiftlint' : 'periphery'))(
            `${sample.check} reports ${sample.expected.rule} in a Swift package and passes after the fix`,
            async () => {
                const result = await runCheckSample(installedSandbox(), sample, SWIFT_PACKAGE_SANDBOX);
                expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
            },
        );
    }
});
