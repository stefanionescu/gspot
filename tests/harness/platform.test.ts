import { realpathSync } from 'node:fs';
import { basename, delimiter } from 'node:path';
import { toolsPath } from '#tests/harness/planted.ts';
import { describe, expect, spyOn, test } from 'bun:test';

// Mise is the subprocess boundary; the resulting search path must locate a real executable.
describe('the planted harness tool path', () => {
    test('preserves the first executable directory using native path separators', () => {
        const outcome = Bun.spawnSync([process.execPath, '--version'], { stdout: 'pipe', stderr: 'pipe' });
        const probe = spyOn(Bun, 'spawnSync').mockReturnValueOnce({
            ...outcome,
            stdout: Buffer.from(`${process.execPath}\n`),
        });
        let search: string;
        try {
            search = toolsPath(['bun']);
        } finally {
            probe.mockRestore();
        }
        const first = search.split(delimiter)[0]!;
        const executable = Bun.which(basename(process.execPath), { PATH: first });
        expect(executable).not.toBeNull();
        expect(realpathSync(executable!)).toBe(realpathSync(process.execPath));
    });
});
