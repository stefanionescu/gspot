import type { Command } from 'commander';
import type { ReferencePage } from './page';
import { referencePage, section, table, cell } from './page';
import { buildProgram } from '@gspot/cli/src/commands/program.ts';

function commandPage(command: Command, name: string): ReferencePage {
    const rootCommand = name.split(' ', 1)[0]!;
    const owner =
        rootCommand === 'completion'
            ? 'commands/completion.ts'
            : ['init', 'doctor', 'check', 'explain', 'apply'].includes(rootCommand)
              ? `commands/${rootCommand}/command.ts`
              : ['add', 'remove'].includes(rootCommand)
                ? 'commands/configurations.ts'
                : `commands/${rootCommand}.ts`;
    const helper = command.createHelp();
    helper.showGlobalOptions = true;
    const usage = helper.commandUsage(command);
    const visible = new Map(
        [...helper.visibleGlobalOptions(command), ...helper.visibleOptions(command)].map((option) => [
            option.flags,
            option,
        ]),
    );
    const options = [...visible.values()].map((option) => [
        `\`${option.flags}\``,
        cell(helper.optionDescription(option)),
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
    const details = help.split('\nEffects:\n', 2)[1];
    if (details === undefined || !details.includes('\n\nExit codes:\n') || !details.includes('\n\nExample:\n'))
        throw new Error(`Command ${name} has no effects, exits, or example documentation.`);
    const behavior = `\n## Effects and prerequisites\n\n${details
        .replace('\n\nExit codes:\n', '\n\n## Exit codes\n\n')
        .replace(
            '\n\nExample:\n',
            '\n\n## Example\n\nRun from the repository root, or select it with \`-C <dir>\`.\n\n\`\`\`shell\n',
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
