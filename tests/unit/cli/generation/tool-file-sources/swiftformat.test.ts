import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CLEAN_SWIFT } from '#tests/config/swift/lint.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/config/xcode.ts';
import { SWIFT_VERSION_FILES, SWIFT_PROJECT_SETTINGS } from '#tests/config/swift/projects.ts';

test("SwiftFormat reads each scope's Swift version from Package.swift", async () => {
    await using sandbox = await testdir(SWIFT_VERSION_FILES);
    const outputs = generate(await openSession(sandbox.path)).files;
    expect(outputs.find((file) => file.path === '.gspot/config/swiftformat')?.content).toContain(
        '--swiftversion 5.9\n',
    );
    expect(outputs.find((file) => file.path === '.gspot/config/nested/swiftformat')?.content).toContain(
        '--swiftversion 6.3.2\n',
    );
});

test('SwiftFormat uses the Xcode project you choose in each scope', async () => {
    const files = {
        'source.swift': CLEAN_SWIFT,
        'nested/source.swift': CLEAN_SWIFT,
        'disabled/source.swift': CLEAN_SWIFT,
        'gspot.toml': SWIFT_PROJECT_SETTINGS,
        'Unused.xcodeproj/project.pbxproj': 'not native plist syntax',
        'Chosen.xcodeproj/project.pbxproj': BUILD_SETTINGS_PBXPROJ,
        'nested/Chosen.xcodeproj/project.pbxproj': BUILD_SETTINGS_PBXPROJ.replace(
            'SWIFT_VERSION=6.0',
            'SWIFT_VERSION=5.5',
        ),
    };
    await using sandbox = await testdir(files);
    const session = await openSession(sandbox.path);
    const outputs = generate(session).files;
    expect(outputs.find((file) => file.path === '.gspot/config/swiftformat')?.content).toContain(
        '--swiftversion 6.0\n',
    );
    expect(outputs.find((file) => file.path === '.gspot/config/nested/swiftformat')?.content).toContain(
        '--swiftversion 5.5\n',
    );
    expect(outputs.some((file) => file.path === '.gspot/config/disabled/swiftformat')).toBe(false);
});

test.each(['lf', 'crlf'] as const)('SwiftFormat writes the %s line ending you set in each scope', async (ending) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['swift'], {
            level: 'all',
            tables: `[format]\nline_ending = "${ending}"\n[[scope]]\npath = "child"\nconfigurations = ["swift"]\nformat.line_ending = "${ending === 'lf' ? 'crlf' : 'lf'}"\n`,
        }),
        'Value.swift': CLEAN_SWIFT,
        'child/Value.swift': CLEAN_SWIFT,
    });
    const files = generate(await openSession(sandbox.path)).files;
    expect(files.find((file) => file.path === '.gspot/config/swiftformat')!.content).toContain(
        `--linebreaks ${ending}\n`,
    );
    expect(files.find((file) => file.path === '.gspot/config/child/swiftformat')!.content).toContain(
        `--linebreaks ${ending === 'lf' ? 'crlf' : 'lf'}\n`,
    );
});
