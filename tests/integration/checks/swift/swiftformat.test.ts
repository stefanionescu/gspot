import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { CLEAN_SWIFT, SWIFT_SANDBOX } from '#tests/data/checks/swift/sandbox.ts';

import {
    SOURCE_HEADER,
    SWIFT_INLINE_DOCS,
    SWIFT_DOCS_SOURCE,
    INLINE_COMMENT_POSITIONS,
} from '#tests/data/integration/checks/swift/swiftformat.ts';

const installedSandbox = shareInstalledSandbox(SWIFT_SANDBOX);
test.skipIf(!hasToolBuild('swiftformat'))('swiftformat keeps the source header when it fixes spacing', async () => {
    const { root, environment } = installedSandbox();

    const path = join(root, 'Sources/App/Greeting.swift');
    await using _change = await changeAppliedSandbox(installedSandbox(), {
        check: 'swift/swiftformat',
        files: {
            'Sources/App/Greeting.swift': SOURCE_HEADER + CLEAN_SWIFT.replace('func greeting', 'func   greeting'),
        },
    });

    const fixed = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--fix'], environment);

    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);

    expect(await readFile(path, 'utf8')).toBe(SOURCE_HEADER + CLEAN_SWIFT);
});
// SwiftFormat has no Windows build.
test.skipIf(!hasToolBuild('swiftformat'))(
    'at level recommended, SwiftFormat leaves Swift block comments unchecked',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'recommended' }),
            'Value.swift': SWIFT_DOCS_SOURCE,
        });

        const configured = await spawnGspot(sandbox.path, ['apply']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        expect(await readDocumentationFindings(sandbox.path, 1, '')).toStrictEqual([]);
        expect(await readFile(join(sandbox.path, 'Value.swift'), 'utf8')).toBe(SWIFT_DOCS_SOURCE);
    },
);
async function readDocumentationFindings(root: string, code: 0 | 1, scope: string) {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    const report = result.report;
    expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        ...(scope === '' ? [] : [{ scope: '', status: 'skipped' as const }]),
        { scope, status: code === 0 ? 'passed' : 'failed' },
    ]);
    return report.checks.flatMap(({ findings }) => findings.filter(({ rule }) => rule === 'blockComments'));
}
// The pinned SwiftFormat tool has no Windows build.
test.skipIf(!hasToolBuild('swiftformat'))(
    'at level all, SwiftFormat reports and fixes Swift block comments, and an ignore in gspot.toml stops the finding',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const settings = buildSandboxSettings(['swift'], { level: 'all' });
        await createFileTree(root, { 'gspot.toml': settings, 'Value.swift': SWIFT_DOCS_SOURCE });
        const configured = await spawnGspot(root, ['apply']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        const findings = await readDocumentationFindings(root, 1, '');
        expect(findings.map(({ file, line, column }) => [file, line, column])).toStrictEqual([
            ['Value.swift', 1, 1],
            ['Value.swift', 9, 1],
        ]);
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(SWIFT_DOCS_SOURCE);
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readDocumentationFindings(root, 0, '')).toStrictEqual([]);
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toContain('"/** not documentation */"');
        await writeFile(join(root, 'Value.swift'), SWIFT_DOCS_SOURCE);
        const ignored = await spawnGspot(root, [
            'ignore',
            'swift/swiftformat',
            '--rule',
            'blockComments',
            '--reason',
            'The imported source retains its documentation layout.',
        ]);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        expect(await readDocumentationFindings(root, 1, '')).toStrictEqual([]);
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(SWIFT_DOCS_SOURCE);
    },
);
// The pinned SwiftFormat tool has no Windows build.
test.skipIf(!hasToolBuild('swiftformat'))(
    'SwiftFormat reports inline block comments at their positions and keeps the file mode and swiftformat:disable comments',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
            'Value.swift': SWIFT_INLINE_DOCS,
        });
        const configured = await spawnGspot(root, ['apply']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        await chmod(join(root, 'Value.swift'), 0o444);
        const found = await readDocumentationFindings(root, 1, '');
        const { mode } = await stat(join(root, 'Value.swift'));
        expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
        await chmod(join(root, 'Value.swift'), 0o644);
        expect(found.map(({ line, column }) => [line, column])).toStrictEqual([...INLINE_COMMENT_POSITIONS]);
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(SWIFT_INLINE_DOCS);
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readDocumentationFindings(root, 0, '')).toStrictEqual([]);
        const correctedText = await readFile(join(root, 'Value.swift'), 'utf8');
        expect(correctedText).toContain('"/** literal */"');
        expect(correctedText).toContain('/// An inline /** example */ remains documentation.');
        expect(correctedText).toContain('/** A retained declaration. */');
    },
);
// The pinned SwiftFormat tool has no Windows build.
test.skipIf(!hasToolBuild('swiftformat'))(
    'an ignore limited to a scope path stops SwiftFormat block-comment findings until unignore',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const settings = buildSandboxSettings(['swift'], { level: 'all', scopes: [{ path: 'nested' }] });
        await createFileTree(root, { 'gspot.toml': settings, 'nested/Value.swift': SWIFT_DOCS_SOURCE });
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const ignored = await spawnGspot(root, [
            'ignore',
            'swift/swiftformat',
            '--rule',
            'blockComments',
            '--paths',
            'nested/**',
            '--reason',
            'The imported source retains its documentation layout.',
        ]);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        expect(await readDocumentationFindings(root, 1, 'nested')).toStrictEqual([]);
        const removed = await spawnGspot(root, [
            'unignore',
            'swift/swiftformat',
            '--rule',
            'blockComments',
            '--paths',
            'nested/**',
        ]);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        const findings = await readDocumentationFindings(root, 1, 'nested');
        expect(findings.map(({ file, line, column }) => [file, line, column])).toStrictEqual([
            ['nested/Value.swift', 1, 1],
            ['nested/Value.swift', 9, 1],
        ]);
        expect(await readFile(join(root, 'nested/Value.swift'), 'utf8')).toBe(SWIFT_DOCS_SOURCE);
    },
);
