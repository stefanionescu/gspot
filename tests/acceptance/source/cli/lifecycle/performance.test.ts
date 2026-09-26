// Initialization and staged checks over a large repository stay within the performance limits.
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { script } from '#tests/support/cli/planted.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';

test('initialization and cold and warm staged checks stay within the 5000-file performance limits', async () => {
    await using directory = await testdir();
    const sources = Object.fromEntries(
        Array.from({ length: 5000 }, (_, index) => [`scripts/task-${String(index)}.sh`, script]),
    );
    await createFileTree(directory.path, sources);
    commitAll(directory.path);
    const started = performance.now();
    const initialized = await run(directory.path, ['init', '--yes', '--runner', 'bun']);
    const initMs = performance.now() - started;
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(initMs).toBeLessThan(60_000);
    expect(git(directory.path, ['add', '-A']).code).toBe(0);
    expect(git(directory.path, ['-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Initialize fixture']).code).toBe(0);
    for (let index = 0; index < 10; index += 1) {
        const path = `scripts/task-${String(index)}.sh`;
        writeFileSync(join(directory.path, path), `${script}# Updated source.\n`);
        expect(git(directory.path, ['add', path]).code).toBe(0);
    }
    const measurements: number[] = [];
    for (const ceiling of [30_000, 5000]) {
        const start = performance.now();
        const checked = await run(directory.path, ['check', '--staged', '--json']);
        const elapsed = performance.now() - start;
        measurements.push(elapsed);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const report = JSON.parse(checked.stdout);
        // The first run executes the check; the second run answers from the cache.
        expect(report.checks.find((check: { check: string }) => check.check === 'bash/syntax')?.status).toBe(
            measurements.length === 2 ? 'cache' : 'ok',
        );
        console.log(
            `5000 files: staged ${measurements.length === 1 ? 'cold' : 'warm'} ${elapsed.toFixed(0)} ms; limit ${String(ceiling)} ms`,
        );
        expect(elapsed).toBeLessThan(ceiling);
        expect(report.checks.some((check: { status: string }) => ['error', 'missing'].includes(check.status))).toBe(
            false,
        );
    }
    console.log(
        `5000 files: init ${initMs.toFixed(0)} ms; staged cold ${measurements[0]!.toFixed(0)} ms; warm ${measurements[1]!.toFixed(0)} ms`,
    );
}, 120_000);
