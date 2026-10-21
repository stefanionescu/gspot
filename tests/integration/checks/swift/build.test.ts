import { join } from 'node:path';
import { isOnDisk } from '#tests/setup/files.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readCacheFolder } from '#cli/system/environment.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { isMacos, hasToolBuild } from '#tests/setup/system.ts';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { createCompilerCache } from '#tests/setup/check-input.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { SWIFT_PACKAGE_CASES, SWIFT_PACKAGE_SANDBOX } from '#tests/data/checks/swift/package.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';
import { XCODE_TOOL_SCHEME, XCODE_TOOL_PROJECT, XCODE_BUILD_SETTINGS } from '#tests/data/checks/xcode.ts';
import { SWIFT_VALUE_ERROR, SWIFT_VALUE_SOURCE, SWIFT_LANGUAGE_PACKAGE } from '#tests/data/checks/swift/projects.ts';

// The manifest assigns compiler-backed Swift checks to macOS.
test.skipIf(!isMacos)('swift/build reuses its compiled objects and still reports a changed source', async () => {
    await using sandbox = await testdir();
    await using _cache = await createCompilerCache();
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

// This check needs the Xcode toolchain supplied by macOS.
test.skipIf(!isMacos)(
    'Xcode reuses compiled objects and reports source errors without changing the project',
    async () => {
        await using sandbox = await testdir();
        await using _cache = await createCompilerCache();
        const project = XCODE_TOOL_PROJECT;
        const source = 'let value: Int = 1\nprint(value)\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], {
                tables: XCODE_BUILD_SETTINGS,
            }),
            'Example.xcodeproj/project.pbxproj': project,
            'Example.xcodeproj/xcshareddata/xcschemes/Example.xcscheme': XCODE_TOOL_SCHEME,
            'main.swift': source,
            'untracked.txt': 'authored content\n',
        });
        const command = ['check', '--only', 'swift/build', '--json'];
        const first = await runGspot(sandbox.path, command);
        expect(first.code, first.stdout + first.stderr).toBe(0);
        const compiledFiles = await Array.fromAsync(new Bun.Glob('**/main.o').scan({ cwd: readCacheFolder() }));
        expect(compiledFiles.length).toBeGreaterThan(0);
        const times = await Promise.all(
            compiledFiles.map((file) => stat(join(readCacheFolder(), file)).then(({ mtimeMs }) => mtimeMs)),
        );
        const commentedBuild = parseCheckReport(await runGspot(sandbox.path, command));
        expect(commentedBuild.code, commentedBuild.stdout + commentedBuild.stderr).toBe(0);
        expect(commentedBuild.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
        expect(
            await Promise.all(
                compiledFiles.map((file) => stat(join(readCacheFolder(), file)).then(({ mtimeMs }) => mtimeMs)),
            ),
        ).toStrictEqual(times);
        expect(await readFile(join(sandbox.path, 'main.swift'), 'utf8')).toBe(source);
        expect(await readFile(join(sandbox.path, 'Example.xcodeproj/project.pbxproj'), 'utf8')).toBe(project);
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
    const installedSandbox = registerSharedSandbox(SWIFT_PACKAGE_SANDBOX);

    for (const entry of SWIFT_PACKAGE_CASES) {
        test.skipIf(!hasToolBuild(entry.check === 'swift/swiftlint-analyze' ? 'swiftlint' : 'periphery'))(
            `${entry.check} reports ${entry.expected.rule} in a Swift package and passes after the fix`,
            async () => {
                const result = await runCheckSample(installedSandbox(), entry, SWIFT_PACKAGE_SANDBOX);
                expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
            },
        );
    }
});
