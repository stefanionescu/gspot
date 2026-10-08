import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { openSession } from '#cli/commands/session.ts';
import { XCODE_METADATA } from '#tests/config/samples/xcode.ts';
import { CLEAN_SWIFT } from '#tests/config/samples/swift/source.ts';
import { SWIFT_VERSION_FILES, SWIFT_PROJECT_POLICY } from '#tests/config/cli/generation/swift.ts';

test('SwiftFormat reads each scope native package version without changing its source', async () => {
    await using sandbox = await testdir(SWIFT_VERSION_FILES);
    const outputs = emitAll(await openSession(sandbox.path)).files;
    expect(outputs.find((file) => file.path === '.gspot/config/swiftformat')?.content).toContain(
        '--swiftversion 5.9\n',
    );
    expect(outputs.find((file) => file.path === '.gspot/config/nested/swiftformat')?.content).toContain(
        '--swiftversion 6.3.2\n',
    );
    for (const [path, text] of Object.entries(SWIFT_VERSION_FILES))
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(text);
});

test('SwiftFormat uses effective Xcode project choices and preserves authored destinations', async () => {
    const files = {
        'source.swift': CLEAN_SWIFT,
        'nested/source.swift': CLEAN_SWIFT,
        'disabled/source.swift': CLEAN_SWIFT,
        'gspot.toml': SWIFT_PROJECT_POLICY,
        'Unused.xcodeproj/project.pbxproj': 'not native plist syntax',
        'Chosen.xcodeproj/project.pbxproj': XCODE_METADATA,
        'nested/Chosen.xcodeproj/project.pbxproj': XCODE_METADATA.replace('SWIFT_VERSION=6.0', 'SWIFT_VERSION=5.5'),
    };
    await using sandbox = await testdir(files);
    const session = await openSession(sandbox.path);
    const outputs = emitAll(session).files;
    expect(outputs.find((file) => file.path === '.gspot/config/swiftformat')?.content).toContain(
        '--swiftversion 6.0\n',
    );
    expect(outputs.find((file) => file.path === '.gspot/config/nested/swiftformat')?.content).toContain(
        '--swiftversion 5.5\n',
    );
    expect(outputs.find((file) => file.path === '.gspot/config/disabled/swiftformat')?.content).not.toContain(
        '--swiftversion',
    );
    expect(session.scopes.find((entry) => entry.scope.path === '')!.view.options('swift').xcode_destination).toBe(
        'custom root destination',
    );
    expect(session.scopes.find((entry) => entry.scope.path === 'nested')!.view.options('swift').xcode_destination).toBe(
        '',
    );
    for (const [path, text] of Object.entries(files))
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(text);
});
