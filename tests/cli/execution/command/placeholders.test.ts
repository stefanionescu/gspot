import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { CHECK_FIELDS } from '#tests/config/samples/checks.ts';
import type { CommandPart } from '#cli/types/execution/command.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { isolatedFiles, perFileCommands, substituteValue } from '#cli/execution/command/arguments/public.ts';

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

test('an isolated Markdown command retains the companion tool file owned by its manifest', async () => {
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

test.each(['recommended', 'all'] as const)('level arguments retain item boundaries at %s', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['ansible'], { level }),
        'site.yml': '---\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['ansible/ansible-lint'], skips: [] })[0]!;
    const substitutions = { root: sandbox.path, scope: '', files: [], indent: 4 };
    expect(planned.check.command?.map((part) => substituteValue(session, planned, part, substitutions))).toStrictEqual([
        'ansible-lint',
        '--offline',
        '--nocolor',
        '-f',
        'pep8',
        '--profile',
        level === 'all' ? 'production' : 'moderate',
    ]);
    expect(substituteValue(session, planned, '{level:two words $&:three words $$}', substitutions)).toBe(
        level === 'all' ? 'three words $$' : 'two words $&',
    );
    expect(substituteValue(session, planned, 'authored argument', substitutions)).toBe('authored argument');
});

test.each(['{level:moderate}', '{level:moderate:}', '{level:moderate:production:extra}'])(
    'malformed native level arguments are refused: %s',
    (argument) => {
        expect(() =>
            parseConfigurationManifest('level', {
                tables: `[[check]]\nname = "run"\ncommand = ["tool", "${argument}"]\n${CHECK_FIELDS}`,
            }),
        ).toThrow('must write level choices as {level:<recommended>:<all>}');
    },
);
