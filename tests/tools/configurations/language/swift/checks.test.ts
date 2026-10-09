// Native Swift lint and formatting checks preserve source headers and pass after explicit fixes.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import { shareRepository } from '#tests/harness/repository.ts';
import { CLEAN_SWIFT } from '#tests/config/samples/swift/source.ts';
import { REPOSITORY } from '#tests/config/tools/configurations/language/swift/checks.ts';

const testRepository = shareRepository(() => REPOSITORY);

test.skipIf(!hasToolBuild('swiftformat'))('swiftformat keeps the source header when it fixes spacing', async () => {
    const { root, environment } = testRepository();
    const header = '// Greeting.swift\n// Created by Alex Garcia.\n// Copyright 2026 Example Contributors.\n\n';
    const path = join(root, 'Sources/App/Greeting.swift');
    const restore = await applyChanges(root, {
        check: 'swift/swiftformat',
        files: {
            'Sources/App/Greeting.swift': header + CLEAN_SWIFT.replace('func greeting', 'func   greeting'),
        },
    });
    try {
        const fixed = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--fix'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await readFile(path, 'utf8')).toBe(header + CLEAN_SWIFT);
    } finally {
        await restore();
    }
});
