import { createSandbox } from '@gspot/testing';
import { expect, spyOn, test } from 'bun:test';
import * as processes from '#cli/platform/spawn.ts';
import { astGrepMatches } from '#cli/structure/ast-grep.ts';

test('ast-grep batches all file arguments and retains matches from every batch', async () => {
    await using sandbox = await createSandbox({});
    const files = Array.from(
        { length: 5000 },
        (_, index) => `scripts/long path with spaces/source-${String(index)}.sh`,
    );
    const received: string[] = [];
    const search = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    const processRun = spyOn(processes, 'runBlocking').mockImplementation((command) => {
        const batch = command.slice(5);
        received.push(...batch);
        return {
            code: 1,
            missing: false,
            duration: 1,
            stderr: '',
            stdout: JSON.stringify(batch.map((file) => ({ file }))),
        };
    });
    try {
        const matches = astGrepMatches(sandbox.path, 'presets/bash/rules/shell-branches.yml', files);
        expect(received).toEqual(files);
        expect(matches?.map((match) => match.file)).toEqual(files);
        expect(processRun.mock.calls.length).toBeGreaterThan(1);
    } finally {
        search.mockRestore();
        processRun.mockRestore();
    }
});

test('ast-grep rejects a failed scan even when stdout contains partial JSON', async () => {
    await using sandbox = await createSandbox({});
    const search = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    const processRun = spyOn(processes, 'runBlocking').mockReturnValue({
        code: 2,
        missing: false,
        duration: 1,
        stdout: '[]',
        stderr: 'cannot read source.sh',
    });
    try {
        expect(() => astGrepMatches(sandbox.path, 'presets/bash/rules/shell-branches.yml', ['source.sh'])).toThrow(
            'cannot read source.sh',
        );
    } finally {
        search.mockRestore();
        processRun.mockRestore();
    }
});
