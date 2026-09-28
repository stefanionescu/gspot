import type { Command } from 'commander';
import type { ReferencePage } from '../../types/reference.ts';
import { cell, table, section, referencePage } from './page.ts';
import { buildProgram } from '@gspot/cli/src/commands/program.ts';

// The help text splits into the usage and the effects.
const HELP_PARTS = 2;

const COMMAND_OWNERS = new Map([
    ['init', 'commands/init/command.ts'],
    ['doctor', 'commands/doctor/command.ts'],
    ['check', 'commands/check/command.ts'],
    ['explain', 'commands/explain/command.ts'],
    ['apply', 'commands/apply/command.ts'],
    ['add', 'commands/kits.ts'],
    ['remove', 'commands/kits.ts'],
]);

function commandPage(command: Command, name: string): ReferencePage {
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
    const contractText = help.split('\nEffects:\n', HELP_PARTS)[1];
    if (
        contractText === undefined ||
        !contractText.includes('\n\nExit codes:\n') ||
        !contractText.includes('\n\nExample:\n')
    )
        throw new Error(`Command ${name} has no effects, exits, or example documentation.`);
    const behavior = `\n## Effects and prerequisites\n\n${contractText
        .replace('\n\nExit codes:\n', '\n\n## Exit codes\n\n')
        .replace(
            '\n\nExample:\n',
            '\n\n## Example\n\nRun from the repository root, or select it with `-C <dir>`.\n\n```shell\n',
        )
        .trim()}\n\`\`\`\n`;
    const sections = [
        `${command.description()}.\n\n\`\`\`text\n${usage}\n\`\`\`\n`,
        behavior,
        section('Arguments', argumentRows.length === 0 ? '' : table(['Argument', 'Meaning'], argumentRows)),
        section('Options', options.length === 0 ? '' : table(['Flag', 'Meaning'], options)),
    ];
    return referencePage(command.summary(), command.description(), sections.join(''), `packages/cli/src/${owner}`);
}

/**
 * One reference page per visible command, keyed by its Markdown path under commands/.
 * @returns the pages by identity
 */
export function commandPages(): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>();
    const commands = (parent: Command, ancestors: string[]): void => {
        for (const command of parent.createHelp().visibleCommands(parent)) {
            if (!parent.commands.includes(command)) continue;
            const path = [...ancestors, command.name()];
            const id = `commands/${path.join('/')}.md`;
            if (pages.has(id)) throw new Error(`Duplicate reference identity: ${id}`);
            pages.set(id, commandPage(command, path.join(' ')));
            commands(command, path);
        }
    };
    commands(buildProgram(), []);
    return pages;
}
