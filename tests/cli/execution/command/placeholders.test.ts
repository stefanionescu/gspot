import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import type { CommandPart } from '#cli/types/execution/command.ts';
import { isolatedFiles, perFileCommands } from '#cli/execution/command/placeholders.ts';

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

test('an isolated Markdown command retains the companion configuration owned by its manifest', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['markdown']),
        'README.md': '# Example\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['markdown/markdownlint'], skips: [] })[0]!;
    const paths = isolatedFiles(session, planned, planned.check.command!);
    expect(paths).toContain('.gspot/config/markdownlint-cli2.mjs');
    expect(paths).toContain('.gspot/config/markdownlint.jsonc');
    expect(paths).toContain('README.md');
    expect(() => isolatedFiles(session, planned, ['markdownlint-cli2', '{tool_file:absent}'])).toThrow(
        'Check markdown/markdownlint names {tool_file:absent} and no configuration writes it.',
    );
});
