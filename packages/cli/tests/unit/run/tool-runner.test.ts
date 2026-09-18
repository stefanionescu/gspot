import { createFixture } from 'fs-fixture';
import { run } from '#cli/platform/spawn.ts';
import { describe, expect, test } from 'bun:test';
import { fileBatches } from '#cli/run/tool-runner.ts';

describe('spawning a tool', () => {
    test('a run past its timeout is stopped and says so', async () => {
        await using fixture = await createFixture({});
        const result = await run(['sleep', '5'], { cwd: fixture.path, timeoutMs: 200 });
        expect(result.isTimedOut).toBe(true);
        expect(result.duration).toBeLessThan(3000);
    });

    test('a run inside its timeout reports no timeout', async () => {
        await using fixture = await createFixture({});
        const result = await run(['true'], { cwd: fixture.path, timeoutMs: 5000 });
        expect(result.isTimedOut).toBe(false);
        expect(result.code).toBe(0);
    });
});

describe('file batches', () => {
    test('a list that fits is one batch, and a long list splits under the budget in order', () => {
        expect(fileBatches(['a.sh', 'b.sh'], 100)).toEqual([['a.sh', 'b.sh']]);
        const files = Array.from({ length: 5000 }, (_, index) => `scripts/deploy/step-${String(index)}.sh`);
        const batches = fileBatches(files, 30_000);
        expect(batches.length).toBeGreaterThan(1);
        expect(batches.flat()).toEqual(files);
        for (const batch of batches) expect(batch.join(' ').length).toBeLessThanOrEqual(30_000);
    });
});
