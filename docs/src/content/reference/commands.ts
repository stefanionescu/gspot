import type { ReferencePage } from '../../types/reference.ts';
import { cell, table, section, referencePage } from './page.ts';
import { buildProgram } from '@gspothq/cli/src/commands/program.ts';
import type { CommandUnknownOpts } from '@commander-js/extra-typings';

// The file that registers each command, which its reference page links to.
const COMMAND_OWNERS = new Map([
    ['init', 'commands/init/command.ts'],
    ['doctor', 'commands/doctor/command.ts'],
    ['check', 'commands/check/command.ts'],
    ['explain', 'commands/explain/command.ts'],
    ['install', 'commands/install/command.ts'],
]);

// The help after the options as Markdown: the levels of set, then the exit codes and an example of every command.
function helpSections(name: string, help: string): string {
    const starts = ['\nLevels:\n', '\nExit codes:\n'].map((heading) => help.indexOf(heading)).filter((at) => at !== -1);
    const contractText = help.slice(Math.min(...starts));
    if (!contractText.includes('\nExit codes:\n') || !contractText.includes('\n\nExample:\n'))
        throw new Error(`Command ${name} has no exits or example documentation.`);
    return `\n${contractText
        .replace('\nLevels:\n', '\n## Levels\n\n')
        .replace('\nExit codes:\n', '\n## Exit codes\n\n')
        .replace('\n\nExample:\n', '\n\n## Example\n\n```shell\n')
        .trim()}\n\`\`\`\n`;
}

function commandPage(command: CommandUnknownOpts, name: string): ReferencePage {
    const [rootCommand = name] = name.split(' ', 1);
    const owner = COMMAND_OWNERS.get(rootCommand) ?? `commands/${rootCommand}.ts`;
    const helpFormat = command.createHelp();
    helpFormat.showGlobalOptions = true;
    const usage = helpFormat.commandUsage(command);
    const visible = new Map(
        [...helpFormat.visibleGlobalOptions(command), ...helpFormat.visibleOptions(command)].map((option) => [
            option.flags,
            option,
        ]),
    );
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
        `${command.description()}\n\n\`\`\`text\n${usage}\n\`\`\`\n`,
        behavior,
        section('Arguments', argumentRows.length === 0 ? '' : table(['Argument', 'Meaning'], argumentRows)),
        section('Options', options.length === 0 ? '' : table(['Flag', 'Meaning'], options)),
    ];
    // The page's summary line is the description's first sentence.
    const [opening = ''] = command.description().split('. ');
    return referencePage(
        command.summary(),
        opening.replace(/\.$/u, ''),
        sections.join(''),
        `packages/cli/src/${owner}`,
    );
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
            `Run each command from the repository root, or select the root with \`-C <dir>\`.\n\n${table(['Command', 'What it does'], rows)}\n`,
            'packages/cli/src/commands/program.ts',
        ),
    );
    return pages;
}
