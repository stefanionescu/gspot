import { expect, test } from 'bun:test';
import { perFileCommands } from '#cli/run/command-expansion.ts';
import type { CommandPart } from '#cli/run/command-expansion.ts';

test.each([0, 1, 2])('replaces a file marker at position %s without dropping neighboring arguments', (slot) => {
    const parts: CommandPart[] = ['before', 'after'];
    parts.splice(slot, 0, { file: true });
    const commands = perFileCommands(parts, ['one.txt', 'café folder/two.txt']);
    for (const [index, file] of ['one.txt', 'café folder/two.txt'].entries()) {
        const expected = ['before', 'after'];
        expected.splice(slot, 0, file);
        expect(commands[index]).toStrictEqual({ argv: expected, file });
    }
});
