// Replay the Swift tutorial scaffold, initialization, source finding, and correction through native tools.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { isMacos } from '#tests/config/harness/platforms.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { environmentVariables } from '#cli/platform/environment.ts';
import { initRepository, buildSandboxPath } from '#tests/harness/install.ts';
import { TESTS, SOURCE, INVALID_SOURCE } from '#tests/config/tools/commands/swift-quickstart.ts';

test.skipIf(!isMacos)('the Swift quickstart reports its source defect and accepts the restored source', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'orders-swift');
    await mkdir(root);
    const environment = { PATH: buildSandboxPath(['swiftlint']) };
    const scaffold = await runTestCommand(['swift', 'package', 'init', '--type', 'library'], {
        cwd: root,
        env: { ...environmentVariables(), ...environment },
    });
    expect(scaffold.code, scaffold.stdout + scaffold.stderr).toBe(0);
    await createFileTree(root, {
        'Sources/orders-swift/orders_swift.swift': SOURCE,
        'Tests/orders-swiftTests/orders_swiftTests.swift': TESTS,
    });
    commitAll(root);
    await initRepository(root, ['init', '--yes', '--configurations', 'swift'], environment);
    const source = join(root, 'Sources/orders-swift/orders_swift.swift');
    const original = await readFile(source, 'utf8');
    gitOutput(root, ['add', '-A']);
    gitOutput(root, ['commit', '-qm', 'chore: Set up gspot', '--no-verify']);
    await writeFile(source, INVALID_SOURCE);
    const rejected = await spawnGspot(root, ['check', '--only', 'swift/swiftlint'], environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout).toContain(
        'Sources/orders-swift/orders_swift.swift:2:11  force_cast  Force casts should be avoided',
    );
    expect(rejected.stdout).toContain('force_cast');
    gitOutput(root, ['add', '-A']);
    gitOutput(root, [
        'restore',
        '--source=HEAD',
        '--staged',
        '--worktree',
        '--',
        'Sources/orders-swift/orders_swift.swift',
    ]);
    expect(await readFile(source, 'utf8')).toBe(original);
    const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftlint'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
