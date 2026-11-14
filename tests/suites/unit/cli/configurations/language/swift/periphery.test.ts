import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { getConfigPath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/config/setup/configurations.ts';

test('periphery.yml names the Xcode project and scheme of its scope', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift'], {
            tables: '[[scope]]\npath = "app"\nswift = { xcode_project = "App.xcodeproj", xcode_scheme = "App" }\n',
        }),
        'Package.swift': '// swift-tools-version:6.0\nimport PackageDescription\n',
        'app/App.xcodeproj/project.pbxproj': BUILD_SETTINGS_PBXPROJ,
        'app/source.swift': '',
    });
    const session = await openSession(sandbox.path);
    const outputs = buildGeneratedFiles(session).files;
    const readPeriphery = (scope: string): unknown =>
        parse(outputs.find((file) => file.path === getConfigPath(session, 'periphery', scope))?.content ?? '');
    expect(readPeriphery('app')).toMatchObject({ project: 'app/App.xcodeproj', schemes: ['App'] });
    expect(readPeriphery('')).not.toHaveProperty('project');
    expect(readPeriphery('')).not.toHaveProperty('schemes');
});
