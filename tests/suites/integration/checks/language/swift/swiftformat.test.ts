import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { CLEAN_SWIFT } from '#tests/config/samples.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { SWIFT_SANDBOX } from '#tests/config/integration/checks/language/swift/samples.ts';

import {
    SOURCE_HEADER,
    SWIFT_INLINE_DOCS,
    SWIFT_DOCS_SOURCE,
    FORMATTED_INLINE_DOCS,
    FORMATTED_DOCS_SOURCE,
    INLINE_COMMENT_FINDINGS,
} from '#tests/config/integration/checks/language/swift/swiftformat.ts';

const installedSandbox = shareInstalledSandbox(SWIFT_SANDBOX);

test.skipIf(!hasToolBuild('swiftformat'))('swiftformat keeps the source header when it fixes spacing', async () => {
    const { root } = installedSandbox();
    const path = join(root, 'Sources/App/Greeting.swift');
    await using _change = await changeAppliedSandbox(installedSandbox(), {
        files: {
            'Sources/App/Greeting.swift': SOURCE_HEADER + CLEAN_SWIFT.replace('func greeting', 'func   greeting'),
        },
    });
    const fixed = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--fix']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(path, 'utf8')).toBe(SOURCE_HEADER + CLEAN_SWIFT);
});

test.skipIf(!hasToolBuild('swiftformat'))(
    'at level recommended, SwiftFormat leaves Swift block comments unchecked',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'recommended' }),
            'Value.swift': SWIFT_DOCS_SOURCE,
        });

        const configured = await spawnGspot(sandbox.path, ['apply']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        expect(await readFormatFindings(sandbox.path, 1, '')).toStrictEqual(spacedCommentFindings('Value.swift'));
        expect(await readFile(join(sandbox.path, 'Value.swift'), 'utf8')).toBe(SWIFT_DOCS_SOURCE);
    },
);

async function readFormatFindings(root: string, code: 0 | 1, scope: string) {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    expect(result.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        ...(scope === '' ? [] : [{ scope: '', status: 'skipped' as const }]),
        { scope, status: code === 0 ? 'passed' : 'failed' },
    ]);
    return result.report.checks.flatMap(({ findings }) =>
        findings.map(({ file, line, column, rule }) => [file, line, column, rule]),
    );
}

test.skipIf(!hasToolBuild('swiftformat'))(
    'at level all, SwiftFormat reports and fixes Swift block comments, and an ignore in gspot.toml stops the finding',
    async () => {
        await using sandbox = await testdir();
        runGitStep(sandbox.path, ['init', '--quiet']);
        const root = sandbox.path;
        const settings = buildSandboxSettings(['swift'], { level: 'all' });
        await createFileTree(root, { 'gspot.toml': settings, 'Value.swift': SWIFT_DOCS_SOURCE });
        const configured = await spawnGspot(root, ['apply']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        expect(await readFormatFindings(root, 1, '')).toStrictEqual(blockCommentFindings('Value.swift'));
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(SWIFT_DOCS_SOURCE);
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readFormatFindings(root, 0, '')).toStrictEqual([]);
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(FORMATTED_DOCS_SOURCE);
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
        expect(await readFormatFindings(root, 1, '')).toStrictEqual(spacedCommentFindings('Value.swift'));
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(SWIFT_DOCS_SOURCE);
    },
);

test.skipIf(!hasToolBuild('swiftformat'))(
    'SwiftFormat reports inline block comments at their positions and keeps the file mode and swiftformat:disable comments',
    async () => {
        await using sandbox = await testdir();
        runGitStep(sandbox.path, ['init', '--quiet']);
        const root = sandbox.path;
        await createFileTree(root, {
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
            'Value.swift': SWIFT_INLINE_DOCS,
        });
        const configured = await spawnGspot(root, ['apply']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        await chmod(join(root, 'Value.swift'), 0o444);
        const found = await readFormatFindings(root, 1, '');
        const { mode } = await stat(join(root, 'Value.swift'));
        expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
        await chmod(join(root, 'Value.swift'), 0o644);
        expect(found).toStrictEqual(INLINE_COMMENT_FINDINGS.map(([line, rule]) => ['Value.swift', line, 1, rule]));
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(SWIFT_INLINE_DOCS);
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readFormatFindings(root, 0, '')).toStrictEqual([]);
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(FORMATTED_INLINE_DOCS);
    },
);

test.skipIf(!hasToolBuild('swiftformat'))(
    'an ignore limited to a scope path stops SwiftFormat block-comment findings until unignore',
    async () => {
        await using sandbox = await testdir();
        runGitStep(sandbox.path, ['init', '--quiet']);
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
        expect(await readFormatFindings(root, 1, 'nested')).toStrictEqual(spacedCommentFindings('nested/Value.swift'));
        const removed = await spawnGspot(root, [
            'unignore',
            'swift/swiftformat',
            '--rule',
            'blockComments',
            '--paths',
            'nested/**',
        ]);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(await readFormatFindings(root, 1, 'nested')).toStrictEqual(blockCommentFindings('nested/Value.swift'));
        expect(await readFile(join(root, 'nested/Value.swift'), 'utf8')).toBe(SWIFT_DOCS_SOURCE);
    },
);

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function blockCommentFindings(file: string) {
    return [
        [file, 1, 1, 'blockComments'],
        [file, 9, 1, 'blockComments'],
    ];
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in this file share it.
function spacedCommentFindings(file: string) {
    return [
        [file, 9, 1, 'docComments'],
        [file, 9, 1, 'spaceInsideComments'],
    ];
}
