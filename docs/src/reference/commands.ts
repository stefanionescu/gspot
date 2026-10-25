import { CLI_REFERENCE } from './cli.ts';
import { ENVIRONMENT_VARIABLES } from '../config/reference.ts';
import { GLOBAL_OPTIONS, PROGRAM_EXIT_CODES } from '#cli/config/main.ts';
import { formatTable, formatSection, buildReferencePage } from './markdown.ts';
import { type ReferencePage, type CommandReference } from '../types/reference.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function formatOptionValues(option: { choices?: string[]; default?: unknown }): string {
    return (
        (option.choices === undefined
            ? ''
            : ' Choices: ' + option.choices.map((value) => `\`${value}\``).join(', ') + '.') +
        (option.default === undefined ? '' : ` Default: \`${JSON.stringify(option.default)}\`.`)
    );
}

function formatCommand(command: CommandReference): string {
    const argumentRows = command.arguments.map((argument) => [
        `\`${argument.name}\``,
        `${argument.description}. ${argument.required ? 'Required.' : 'Optional.'}` + formatOptionValues(argument),
    ]);
    const optionRows = command.options
        .filter((option) => !Object.hasOwn(GLOBAL_OPTIONS, option.flags))
        .map((option) => [`\`${option.flags}\``, `${option.description}.` + formatOptionValues(option)]);
    const blocks = [
        command.description,
        `\`\`\`shell\n${command.usage}\n\`\`\``,
        formatTable(['Argument', 'What it is'], argumentRows),
        formatTable(['Option', 'What it does'], optionRows),
        formatTable(
            ['Exit code', 'Meaning'],
            command.exitCodes.map(([codes, meaning]) => [`\`${codes}\``, meaning]),
        ),
        'For example:',
        `\`\`\`shell\n${command.example}\n\`\`\``,
    ];
    return formatSection(`gspot ${command.name}`, blocks.filter(Boolean).join('\n\n'));
}

/**
Build the Commands page from the CLI help data, with a section per command in program order.

@returns the Commands page, with its title, description, and Markdown body
*/
export function buildCommandPage(): ReferencePage {
    const { commands } = CLI_REFERENCE;
    const commandRows = commands.map((command) => [
        `[\`gspot ${command.name}\`](#gspot-${command.name})`,
        command.summary,
    ]);
    const globalOptions = Object.entries(GLOBAL_OPTIONS).map(([flags, description]) => [
        `\`${flags}\``,
        description + '.',
    ]);
    const exitCodes = PROGRAM_EXIT_CODES.map(([codes, meaning]) => [`\`${codes}\``, meaning]);
    return buildReferencePage(
        'Commands',
        'Every gspot command, its options, and its exit codes.',
        `Run gspot from any folder of the repository; it uses the \`gspot.toml\` at the top of the Git repository. Start each command the way your repository runs gspot, such as \`bun run --no-install gspot\` or \`mise exec -- gspot\`. See [Installation](/start/install/#choose-how-to-install). Commands that change settings write generated files too.\n\n` +
            formatTable(['Command', 'What it does'], commandRows) +
            '\n' +
            commands.map((command) => formatCommand(command)).join('') +
            formatSection('Global options', formatTable(['Option', 'What it does'], globalOptions)) +
            formatSection(
                'Exit codes',
                `Every command exits with one of these codes.\n\n${formatTable(['Exit code', 'Meaning'], exitCodes)}`,
            ) +
            formatSection('Environment variables', formatTable(['Variable', 'What it does'], ENVIRONMENT_VARIABLES)),
    );
}
