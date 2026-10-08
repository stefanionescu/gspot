import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { XCODE_METADATA } from '#tests/config/samples/xcode.ts';
import { CLEAN_SWIFT } from '#tests/config/samples/swift/source.ts';
import { SWIFT_LINE_ENDINGS, SWIFT_VERSION_FILES, SWIFT_PROJECT_POLICY } from '#tests/config/cli/generation/swift.ts';

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

test.each(SWIFT_LINE_ENDINGS)('SwiftFormat emits native %s line endings and only actual rule keys', async (ending) => {
    await using sandbox = await testdir();
    for (const level of ['recommended', 'all'] as const) {
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['swift', 'nginx'], {
                level,
                tables: `[format]\nline_ending = "${ending}"\n[scope."child"]\nconfigurations = ["swift"]\n[scope."child".format]\nline_ending = "${ending === 'lf' ? 'crlf' : 'lf'}"\n`,
            }),
            'Value.swift': CLEAN_SWIFT,
            'child/Value.swift': CLEAN_SWIFT,
            'nginx.conf': 'events {}\nhttp {}\n',
        });
        const files = emitAll(await openSession(sandbox.path)).files;
        const root = files.find((file) => file.path === '.gspot/config/swiftformat')!;
        const child = files.find((file) => file.path === '.gspot/config/child/swiftformat')!;
        expect(root.content).toContain(`--linebreaks ${ending}\n`);
        expect(child.content).toContain(`--linebreaks ${ending === 'lf' ? 'crlf' : 'lf'}\n`);
        expect(Object.keys(root.ruleData!)).toStrictEqual(['enable', 'disable']);
        expect(Object.keys(files.find((file) => file.path === '.gspot/config/gixy.cfg')!.ruleData!)).toStrictEqual([
            'skips',
        ]);
    }
});
