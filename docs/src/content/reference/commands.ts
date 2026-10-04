import type { ReferencePage } from '../../types/reference.ts';
import { cell, table, section, referencePage } from './page.ts';
import { buildProgram } from '@gspothq/cli/src/commands/program.ts';
import type { CommandUnknownOpts } from '@commander-js/extra-typings';
import { COMMAND_OWNERS, COMMAND_EXAMPLES } from '../../config/reference.ts';

// The help after the options as Markdown: the levels of set, then the exit codes and an example of every command.
function helpSections(name: string, help: string): string {
    const exits = help.indexOf('\nExit codes:\n');
    const example = help.indexOf('\n\nExample:\n');
    if (exits === -1 || example === -1) throw new Error(`Command ${name} has no exits or example documentation.`);
    const levels = help.indexOf('\nLevels:\n');
    const levelText = levels === -1 ? '' : section('Levels', help.slice(levels + '\nLevels:\n'.length, exits).trim());
    const second = COMMAND_EXAMPLES[name];
    const examples =
        help.slice(example + '\n\nExample:\n'.length).trim() + (second === undefined ? '' : '\n\n' + second);
    return (
        section('Examples', `\`\`\`shell\n${examples}\n\`\`\``) +
        section('Exit codes', help.slice(exits + '\nExit codes:\n'.length, example).trim()) +
        levelText
    );
}

function commandPage(command: CommandUnknownOpts, name: string): ReferencePage {
    const [rootCommand = name] = name.split(' ', 1);
    const owner = COMMAND_OWNERS[rootCommand] ?? `commands/${rootCommand}.ts`;
    const helpFormat = command.createHelp();
    helpFormat.showGlobalOptions = false;
    const usage = helpFormat.commandUsage(command);
    const visible = new Map(helpFormat.visibleOptions(command).map((option) => [option.flags, option]));
    const options = [...visible.values()].map((option) => [
        `\`${option.flags}\``,
        cell(helpFormat.optionDescription(option)),
    ]);
    const argumentRows = command.registeredArguments.map((argument) => [
        `\`${argument.name()}\``,
        cell(argument.description || (argument.required ? 'required' : 'optional')),
    ]);
    let help = '';
    const output = { ...command.configureOutput() };
    try {
        command.configureOutput({
            writeOut: (text) => {
                help += text;
            },
        });
        command.outputHelp();
    } finally {
        command.configureOutput(output);
    }
    const behavior = helpSections(name, help);
    const sections = [
        `\`\`\`text\n${usage}\n\`\`\`\n`,
        section('Arguments', argumentRows.length === 0 ? '' : table(['Argument', 'Meaning'], argumentRows)),
        section('Options', options.length === 0 ? '' : table(['Flag', 'Meaning'], options)),
        behavior,
    ];
    // The page's summary line is the description's first sentence.
    const [opening = ''] = command.description().split('. ');
    return referencePage(`gspot ${name}`, opening.replace(/\.$/u, ''), sections.join(''), `packages/cli/src/${owner}`);
}

/**
 * The commands index and one reference page per visible command, keyed by Markdown path under commands/.
 * @returns the pages by identity
 */
export function commandPages(): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>();
    const program = buildProgram();
    const commands = (parent: CommandUnknownOpts, ancestors: string[]): void => {
        for (const command of parent.createHelp().visibleCommands(parent)) {
            if (!parent.commands.includes(command)) continue;
            const path = [...ancestors, command.name()];
            const id = `commands/${path.join('/')}.md`;
            if (pages.has(id)) throw new Error(`Duplicate reference identity: ${id}`);
            pages.set(id, commandPage(command, path.join(' ')));
            commands(command, path);
        }
    };
    commands(program, []);
    const rows = program.commands.map((command) => [
        `[\`gspot ${command.name()}\`](/reference/commands/${command.name()}/)`,
        cell(command.summary()),
    ]);
    pages.set(
        'commands/index.md',
        referencePage(
            'Commands',
            'Every gspot command and what it does.',
            `Run gspot from any folder in the repository; it finds the nearest \`gspot.toml\`. \`-C <dir>\` starts in another folder. Add the [prefix for your runner](/guides/install/) to commands.\n\n${table(['Command', 'What it does'], rows)}\n\n## Global options\n\n${table(
                ['Flag', 'Meaning'],
                program
                    .createHelp()
                    .visibleOptions(program)
                    .map((option) => [`\`${option.flags}\``, cell(program.createHelp().optionDescription(option))]),
            )}\n`,
            'packages/cli/src/commands/program.ts',
        ),
    );
    return pages;
}
