// Replay the tutorial through native bootstrap, setup, checks, and Git hooks.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { openRoot } from '#cli/platform/root/open.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { isMacos } from '#tests/config/harness/platforms.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { prepareQuickstart } from '#tests/harness/quickstart.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { SETUP_COMMANDS } from '#tests/config/samples/quickstart.ts';

import {
    TESTS,
    SOURCE,
    INITIALIZE,
    SOURCE_PATH,
    INVALID_SOURCE,
} from '#tests/config/tools/commands/swift-quickstart.ts';

test.skipIf(!isMacos)(
    'the Swift tutorial reports its finding through the installed hook and passes after the fix',
    async () => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, 'orders-swift');
        await mkdir(root);
        await using prepared = await prepareQuickstart(root);
        const environment = prepared.environment;
        expect(
            await runTestCommand(['swift', 'package', 'init', '--type', 'library'], {
                cwd: root,
                env: { ...environmentVariables(), ...environment },
            }),
        ).toMatchObject({ code: 0 });
        await createFileTree(root, {
            'Sources/orders-swift/orders_swift.swift': SOURCE,
            'Tests/orders-swiftTests/orders_swiftTests.swift': TESTS,
        });
        commitAll(root);
        expect(
            await runTestCommand(['mise', 'exec', `npm:@gspothq/cli@${packageManifest.version}`, '--', ...INITIALIZE], {
                cwd: root,
                env: environment,
            }),
        ).toMatchObject({ code: 0 });
        for (const { command, code } of SETUP_COMMANDS) {
            const result = await runTestCommand(command, { cwd: root, env: environment });
            expect(result.code, result.stdout + result.stderr).toBe(code);
        }
        using files = openRoot(root);
        const original = files.read(SOURCE_PATH)!;
        gitOutput(root, ['add', '-A']);
        expect(git(root, ['commit', '-qm', 'chore: Set up gspot'], environment)).toMatchObject({ code: 0 });
        files.write(SOURCE_PATH, { bytes: Buffer.from(INVALID_SOURCE), mode: original.mode }, original);
        const rejected = await runTestCommand(['mise', 'exec', '--', 'gspot', 'check', '--only', 'swift/swiftlint'], {
            cwd: root,
            env: environment,
        });
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        expect(rejected.stdout).toContain(
            'Sources/orders-swift/orders_swift.swift:2:11  force_cast  Force casts should be avoided',
        );
        gitOutput(root, ['add', '-A']);
        const refused = git(root, ['commit', '-qm', 'feat: Add invalid source'], environment);
        expect(refused.code).not.toBe(0);
        expect(refused.stdout + refused.stderr).toContain('force_cast');
        gitOutput(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', SOURCE_PATH]);
        const restored = files.read(SOURCE_PATH)!;
        expect(restored.bytes).toStrictEqual(original.bytes);
        expect(restored.mode).toBe(original.mode);
        const corrected = await runTestCommand(['mise', 'exec', '--', 'gspot', 'check', '--only', 'swift/swiftlint'], {
            cwd: root,
            env: environment,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
