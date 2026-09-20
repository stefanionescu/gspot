import { realpathSync } from 'node:fs';
import { basename, delimiter } from 'node:path';
import { describe, expect, spyOn, test } from 'bun:test';
import { run, toolsPath } from '#tests/harness/planted.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

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

    test('prepending a directory preserves inherited executable lookup', () => {
        const inherited = environmentVariables();
        const result = Bun.spawnSync([basename(process.execPath), '--version'], {
            env: { ...inherited, PATH: `${process.cwd()}${delimiter}${inherited['PATH'] ?? ''}` },
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        expect(result.stdout.toString().trim()).toBe(Bun.version);
    });
});

describe('the planted command deadline', () => {
    test('a timed-out process names its command and retains both diagnostic streams', () => {
        const outcome = Bun.spawnSync([process.execPath, '--version'], { stdout: 'pipe', stderr: 'pipe' });
        const probe = spyOn(Bun, 'spawnSync').mockReturnValueOnce({
            ...outcome,
            exitedDueToTimeout: true,
            stdout: Buffer.from('migration.sql:1: checking\n'),
            stderr: Buffer.from('waiting for tool\n'),
        });
        try {
            expect(() => run(process.cwd(), ['check', 'postgres/squawk'])).toThrow(
                `Command gspot check postgres/squawk timed out in ${process.cwd()}.\nmigration.sql:1: checking\nwaiting for tool\n`,
            );
        } finally {
            probe.mockRestore();
        }
    });
});
