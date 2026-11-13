import { basename, parse } from 'node:path';

import { mock, type Mock, spyOn } from 'bun:test';
import executables from 'which';

import { GIT_PROGRAM } from '#cli/config/system.ts';
import * as processes from '#cli/system/processes/run.ts';
import type { runProcess } from '#cli/system/processes/run.ts';

/**
Replace the child commands that match: the command found by this path or program name, the commands that this test
accepts, or without a match every child command but Git. Run the others normally, through any fake set up before, and
record only the replaced commands. Without a replacement, the replaced commands run normally too.
*/
export function fakeCommands(
    match?: string | ((command: readonly string[]) => boolean),
    spawn?: typeof runProcess,
): Mock<typeof runProcess> {
    const unfaked = processes.runProcess;
    const spy = spyOn(processes, 'runProcess');
    const run = spy.getMockImplementation() ?? unfaked;
    const fake = mock(spawn ?? run);
    spy.mockImplementation((command, options) => {
        const program = command[0] ?? '';
        let isReplaced = program !== GIT_PROGRAM;
        if (typeof match === 'function') isReplaced = match(command);
        else if (match !== undefined) isReplaced = [program, basename(program), parse(program).name].includes(match);
        return isReplaced ? fake(command, options) : run(command, options);
    });
    return Object.assign(fake, {
        [Symbol.dispose]: () => {
            spy.mockRestore();
        },
    });
}

export function fakeExecutableLookup(
    path: string | null | ((name: string) => string | null | undefined),
): Mock<typeof executables.sync> {
    const locate = executables.sync;
    /**
    Stand in for which.sync.

    @returns one path, all paths, or null, as which.sync does.
    */
    const lookUp = (name: string, options?: executables.Options): string | string[] | null => {
        const found = typeof path === 'function' ? path(name) : path;
        if (found === undefined || name === GIT_PROGRAM) return locate(name, options);
        return options?.all === true ? [found].filter((each) => each !== null) : found;
    };
    return spyOn(executables, 'sync').mockImplementation(lookUp as typeof executables.sync);
}
