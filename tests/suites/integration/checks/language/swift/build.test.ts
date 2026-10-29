import { test, expect, describe } from 'bun:test';
import { join, dirname, basename } from 'node:path';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { SWIFT_LANGUAGE_PACKAGE } from '#tests/config/swift.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { redirectCacheFolder } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { isMacos, hasToolBuild } from '#tests/setup/system/platform.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    XCODE_TOOL_PROJECT,
    SWIFT_PACKAGE_CASES,
    SWIFT_PACKAGE_SANDBOX,
} from '#tests/config/integration/checks/language/swift/build.ts';

test.skipIf(!isMacos)('swift/build reuses its compiled objects and still reports a changed source', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift']),
        'Package.swift': SWIFT_LANGUAGE_PACKAGE,
        'Sources/Example/Value.swift': 'public let value: Int = 1\n',
    });
    await using _cache = await redirectCacheFolder();
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
    await writeFile(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = "wrong"\n');
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
        const source = 'let value: Int = 1\nprint(value)\n';
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], {
                tables: `[swift]
xcode_project = "Example.xcodeproj"
xcode_scheme = "Example"
xcode_destination = "platform=macOS"
`,
            }),
            'Example.xcodeproj/project.pbxproj': XCODE_TOOL_PROJECT,
            'Example.xcodeproj/xcshareddata/xcschemes/Example.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Example" BlueprintName="Example" ReferencedContainer="container:Example.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug"/></Scheme>\n',
            'main.swift': source,
            'untracked.txt': 'authored content\n',
        });
        await using _cache = await redirectCacheFolder();
        const command = ['check', '--only', 'swift/build', '--json'];
        const first = await runGspot(sandbox.path, command);
        expect(first.code, first.stdout + first.stderr).toBe(0);
        const compiledFiles = await Array.fromAsync(new Bun.Glob('**/main.o').scan({ cwd: readCacheFolder() }));
        expect(
            compiledFiles.map((file) => basename(dirname(file))).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['arm64', 'x86_64']);
        const times = await Promise.all(
            compiledFiles.map(async (file) => {
                const { mtimeMs } = await stat(join(readCacheFolder(), file));
                return mtimeMs;
            }),
        );
        const unchangedBuild = parseCheckReport(await runGspot(sandbox.path, command));
        expect(unchangedBuild.code, unchangedBuild.stdout + unchangedBuild.stderr).toBe(0);
        expect(unchangedBuild.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
        expect(
            await Promise.all(
                compiledFiles.map(async (file) => {
                    const { mtimeMs } = await stat(join(readCacheFolder(), file));
                    return mtimeMs;
                }),
            ),
        ).toStrictEqual(times);
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
        test.skipIf(!hasToolBuild(sample.tool))(
            `${sample.check} reports ${sample.expected.rule} in a Swift package and passes after the fix`,
            async () => {
                await assertCheckSample(installedSandbox(), sample);
            },
        );
    }
});
