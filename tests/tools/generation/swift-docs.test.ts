import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { stat, chmod } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { SWIFT_DOCS_SOURCE, SWIFT_INLINE_DOCS, SWIFT_FORMAT_CHECK } from '#tests/config/tools/generation/swift-docs.ts';

async function documentationFindings(root: string, code: 0 | 1) {
    const result = await spawnGspot(root, SWIFT_FORMAT_CHECK);
    expect(result.code, result.stdout + result.stderr).toBe(code);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.every(({ status }) => status === (code === 0 ? 'passed' : 'failed'))).toBe(true);
    return report.checks.flatMap(({ findings }) => findings.filter(({ rule }) => rule === 'blockComments'));
}

// SwiftFormat has no Windows build; Linux and macOS own these native diagnostics.
test.skipIf(!isPosix)('recommended leaves Swift block comments unchecked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift'], { tables: '[agent_rules]\nenabled = false\n', level: 'recommended' }),
        'Value.swift': SWIFT_DOCS_SOURCE,
    });
    const configured = await spawnGspot(sandbox.path, ['apply']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    expect(await documentationFindings(sandbox.path, 1)).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, 'Value.swift')).text()).toBe(SWIFT_DOCS_SOURCE);
});

test.skipIf(!isPosix)('all reports and fixes Swift block comments and respects the policy ignore', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const policy = buildPolicy(['swift'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' });
    await createFileTree(root, { 'gspot.toml': policy, 'Value.swift': SWIFT_DOCS_SOURCE });
    const configured = await spawnGspot(root, ['apply']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    const findings = await documentationFindings(root, 1);
    expect(findings.map(({ file, line, column }) => [file, line, column])).toStrictEqual([
        ['Value.swift', 1, 1],
        ['Value.swift', 9, 1],
    ]);
    expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(SWIFT_DOCS_SOURCE);
    const corrected = await spawnGspot(root, [...SWIFT_FORMAT_CHECK, '--fix']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await documentationFindings(root, 0)).toStrictEqual([]);
    expect(await Bun.file(join(root, 'Value.swift')).text()).toContain('"/** not documentation */"');
    await Bun.write(join(root, 'Value.swift'), SWIFT_DOCS_SOURCE);
    const ignored = await spawnGspot(root, [
        'ignore',
        'swift/swiftformat',
        '--rule',
        'blockComments',
        '--reason',
        'The imported source retains its documentation layout.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    expect(await documentationFindings(root, 1)).toStrictEqual([]);
    expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(SWIFT_DOCS_SOURCE);
});

test.skipIf(!isPosix)('Swift inline comments retain native exceptions, modes, and original positions', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['swift'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' }),
        'Value.swift': SWIFT_INLINE_DOCS,
    });
    const configured = await spawnGspot(root, ['apply']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    await chmod(join(root, 'Value.swift'), 0o444);
    const found = await documentationFindings(root, 1);
    const { mode } = await stat(join(root, 'Value.swift'));
    expect(mode & 0o777).toBe(getKeptMode(0o444));
    await chmod(join(root, 'Value.swift'), 0o644);
    expect(found.map(({ line, column }) => [line, column])).toStrictEqual([
        [4, 1],
        [7, 1],
        [8, 1],
        [11, 1],
    ]);
    expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(SWIFT_INLINE_DOCS);
    const corrected = await spawnGspot(root, [...SWIFT_FORMAT_CHECK, '--fix']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await documentationFindings(root, 0)).toStrictEqual([]);
    const correctedText = await Bun.file(join(root, 'Value.swift')).text();
    expect(correctedText).toContain('"/** literal */"');
    expect(correctedText).toContain('/// An inline /** example */ remains documentation.');
    expect(correctedText).toContain('/** A retained declaration. */');
});

test.skipIf(!isPosix)('nested Swift scopes retain their own native formatting exclusions', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const policy = buildPolicy(['swift'], {
        tables: '[agent_rules]\nenabled = false\n[scope."nested"]\n',
        level: 'all',
    });
    await createFileTree(root, { 'gspot.toml': policy, 'nested/Value.swift': SWIFT_DOCS_SOURCE });
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
    expect(await documentationFindings(root, 1)).toStrictEqual([]);
    const removed = await spawnGspot(root, [
        'ignore',
        'swift/swiftformat',
        '--rule',
        'blockComments',
        '--paths',
        'nested/**',
        '--remove',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const findings = await documentationFindings(root, 1);
    expect(findings.map(({ file, line, column }) => [file, line, column])).toStrictEqual([
        ['nested/Value.swift', 1, 1],
        ['nested/Value.swift', 9, 1],
    ]);
    expect(await Bun.file(join(root, 'nested/Value.swift')).text()).toBe(SWIFT_DOCS_SOURCE);
});
