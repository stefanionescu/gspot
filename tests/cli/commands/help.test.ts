import { test, expect } from 'bun:test';
import { buildProgram } from '#cli/public.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { rootSettingSchemas } from '#cli/policy/schema/public.ts';
import { commandPages } from '#docs/src/content/reference/commands.ts';
import { LEVEL_SUMMARY, ALL_LEVEL_SUMMARY } from '#cli/config/policy/settings.ts';

test('every command has native help and reference content from one metadata table', async () => {
    const program = buildProgram();
    const pages = await commandPages();
    expect(Object.keys(COMMAND_HELP).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(
        program.commands.map((command) => command.name()).toSorted((a, b) => a.localeCompare(b)),
    );
    for (const command of program.commands) {
        const metadata = COMMAND_HELP[command.name()]!;
        let help = '';
        command.configureOutput({
            writeOut: (text) => {
                help += text;
            },
        });
        command.outputHelp();
        const page = pages.get(`commands/${command.name()}.md`)!;
        for (const example of metadata.examples.split('\n')) {
            expect(help).toContain(example);
            expect(page.body).toContain(example);
        }
        expect(help).toContain(metadata.exitCodes);
        expect(page.body).toContain(metadata.exitCodes);
    }
    const examples = Object.values(COMMAND_HELP).flatMap((metadata) => metadata.examples.split('\n'));
    expect(new Set(examples).size).toBe(examples.length);
});

test('set help, reference levels, and policy metadata retain the authoritative coverage descriptions', async () => {
    const program = buildProgram();
    const command = program.commands.find((entry) => entry.name() === 'set')!;
    let help = '';
    command.configureOutput({
        writeOut: (text) => {
            help += text;
        },
    });
    command.outputHelp();
    const pages = await commandPages();
    const description = rootSettingSchemas.level.meta()?.description;
    for (const summary of [LEVEL_SUMMARY, ALL_LEVEL_SUMMARY]) {
        expect(COMMAND_HELP['set']?.levels).toContain(summary);
        expect(help).toContain(summary);
        expect(pages.get('commands/set.md')?.body).toContain(summary);
        expect(description).toContain(summary);
    }
});

test('--no-color prints the finding without ANSI escape codes on terminal streams', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy([], { tables: 'exclude = ["absent/**"]\n' }),
    });
    using resources = new DisposableStack();
    for (const stream of [process.stdout, process.stderr]) {
        const original = Object.getOwnPropertyDescriptor(stream, 'isTTY');
        resources.defer(() => {
            if (original === undefined) Reflect.deleteProperty(stream, 'isTTY');
            else Object.defineProperty(stream, 'isTTY', original);
        });
        Object.defineProperty(stream, 'isTTY', { value: true, configurable: true });
    }
    const result = await runGspot(directory.path, ['check', '--only', 'gspot/unmatched-paths', '--no-color'], {
        NO_COLOR: '',
        CI: '',
    });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('absent/** under exclude matches no tracked file or folder.');
    expect(result.stdout).toContain('gspot/unmatched-paths');
    expect(result.stdout + result.stderr).not.toContain('\u001B[');
});
