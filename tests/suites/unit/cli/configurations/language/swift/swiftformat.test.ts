import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { CLEAN_SWIFT } from '#tests/config/setup/languages.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { getConfigPath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/config/setup/configurations.ts';

test("SwiftFormat reads each scope's Swift version from Package.swift", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift'], {
            rules: true,
            scopes: [{ path: 'nested', configurations: ['swift'] }],
        }),
        'Package.swift': '// swift-tools-version:5.9\nimport PackageDescription\n',
        'nested/Package.swift': '// swift-tools-version:6.3.2\nimport PackageDescription\n',
    });
    const session = await openSession(sandbox.path);
    const outputs = buildGeneratedFiles(session).files;
    expect(outputs.find((file) => file.path === getConfigPath(session, 'swiftformat'))?.content).toContain(
        '--swiftversion 5.9\n',
    );
    expect(outputs.find((file) => file.path === getConfigPath(session, 'swiftformat', 'nested'))?.content).toContain(
        '--swiftversion 6.3.2\n',
    );
});

test('SwiftFormat uses the Xcode project you choose in each scope', async () => {
    const files = {
        'source.swift': CLEAN_SWIFT,
        'nested/source.swift': CLEAN_SWIFT,
        'gspot.toml': `configurations = ["swift", "xcode"]
[[scope]]
path = "nested"
swift = {xcode_project = "Chosen.xcodeproj"}

[swift]
xcode_project = "Chosen.xcodeproj"
`,
        'Unused.xcodeproj/project.pbxproj': 'not native plist syntax',
        'Chosen.xcodeproj/project.pbxproj': BUILD_SETTINGS_PBXPROJ,
        'nested/Chosen.xcodeproj/project.pbxproj': BUILD_SETTINGS_PBXPROJ.replace(
            'SWIFT_VERSION=6.0',
            'SWIFT_VERSION=5.5',
        ),
    };
    await using sandbox = await createGitSandbox(files);
    const session = await openSession(sandbox.path);
    const outputs = buildGeneratedFiles(session).files;
    expect(outputs.find((file) => file.path === getConfigPath(session, 'swiftformat'))?.content).toContain(
        '--swiftversion 6.0\n',
    );
    expect(outputs.find((file) => file.path === getConfigPath(session, 'swiftformat', 'nested'))?.content).toContain(
        '--swiftversion 5.5\n',
    );
});
