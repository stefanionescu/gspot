import { access } from 'node:fs/promises';
import { buildProgram } from '#cli/public.ts';
import { COMMAND_OWNERS } from '../../config/reference.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { ReferencePage } from '../../types/reference.ts';
import { cell, table, section, referencePage } from './page.ts';
import type { CommandUnknownOpts } from '@commander-js/extra-typings';

async function commandPage(command: CommandUnknownOpts, name: string): Promise<ReferencePage> {
    const [rootCommand = name] = name.split(' ', 1);
    const owner = COMMAND_OWNERS[rootCommand] ?? `commands/${rootCommand}.ts`;
    await access(new URL(`../../../../packages/cli/src/${owner}`, import.meta.url));
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
    const help = COMMAND_HELP[rootCommand];
    if (help === undefined) throw new Error(`Command ${name} has no help metadata.`);
    const behavior =
        section('Examples', '```shell\n' + help.examples + '\n```') +
        section('Exit codes', help.exitCodes) +
        (help.levels === undefined ? '' : section('Levels', help.levels));
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
export async function commandPages(): Promise<Map<string, ReferencePage>> {
    const pages = new Map<string, ReferencePage>();
    const program = buildProgram();
    const commands = async (parent: CommandUnknownOpts, ancestors: string[]): Promise<void> => {
        for (const command of parent.createHelp().visibleCommands(parent)) {
            if (!parent.commands.includes(command)) continue;
            const path = [...ancestors, command.name()];
            const id = `commands/${path.join('/')}.md`;
            if (pages.has(id)) throw new Error(`Duplicate reference identity: ${id}`);
            pages.set(id, await commandPage(command, path.join(' ')));
            await commands(command, path);
        }
    };
    await commands(program, []);
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
            'packages/cli/src/public.ts',
        ),
    );
    return pages;
}
