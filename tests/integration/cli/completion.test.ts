// Shell completion knows every command and every flag the program declares (T-22).
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { run } from '#cli/platform/spawn.ts';
import { buildProgram } from '#cli/commands/program.ts';
import { COMPLETION_TIMEOUT_MS } from '#tests/constants/integration/cli/cli.ts';

const CLI = fileURLToPath(new URL('../../../packages/cli/src/main.ts', import.meta.url));
async function candidates(words: string[]): Promise<string[]> {
    // The script hands the program the words after its own name, and an empty word asks for every command.
    const result = await run([process.execPath, CLI, 'complete', '--', ...words], {
        cwd: fileURLToPath(new URL('../../..', import.meta.url)),
        timeoutMs: COMPLETION_TIMEOUT_MS,
    });
    expect(result.code, result.stderr).toBe(0);
    return result.stdout
        .split('\n')
        .map((line) => line.split('\t', 1)[0]!)
        .filter((line) => line !== '' && !line.startsWith(':'));
}

const program = buildProgram();
const commands = program.commands.filter((command) => command.name() !== 'complete');

test('the command inventory preserves public commands and their help order', () => {
    expect(program.commands.map((command) => command.name())).toStrictEqual([
        'init',
        'install',
        'check',
        'apply',
        'ignore',
        'add',
        'remove',
        'set',
        'explain',
        'doctor',
        'list',
        'uninstall',
        'export',
        'completion',
        'complete',
    ]);
});

test('completion offers every command of the program', async () => {
    const offered = await candidates(['']);
    for (const command of commands) expect(offered).toContain(command.name());
});

test.each(commands.map((command) => [command.name(), command] as const))(
    'completion offers every flag of %s',
    async (_name, command) => {
        const flags = command.options
            .filter((option) => !option.hidden)
            .map((option) => option.long)
            .filter((flag): flag is string => flag !== undefined);
        if (flags.length === 0) return;
        const offered = await candidates([command.name(), '--']);
        for (const flag of flags) expect(offered, `${command.name()} ${flag}`).toContain(flag);
    },
    COMPLETION_TIMEOUT_MS,
);

test.each(['bash', 'zsh', 'fish', 'powershell'])(
    'the %s script asks the program for its candidates',
    async (interpreter) => {
        const result = await run([process.execPath, CLI, 'completion', interpreter], {
            cwd: fileURLToPath(new URL('../../..', import.meta.url)),
            timeoutMs: COMPLETION_TIMEOUT_MS,
        });
        expect(result.code, result.stderr).toBe(0);
        // Every script defers to the program for its candidates instead of listing them itself.
        expect(result.stdout).toContain(interpreter === 'powershell' ? 'complete' : 'complete --');
        expect(result.stdout).toContain('gspot');
    },
);
