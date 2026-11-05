import { CLI_REFERENCE } from '#cli/reference.ts';
import {
    COMMANDS_DESCRIPTION,
    COMMANDS_OPENING,
    DEFINITION_HEADING,
    ENVIRONMENT_VARIABLES,
    ENVIRONMENT_VARIABLES_HEADING,
    EXAMPLE_MESSAGE,
    EXIT_CODE_HEADING,
    EXIT_CODES_HEADING,
    GLOBAL_OPTIONS_HEADING,
    PURPOSE_HEADING,
} from '#docs/config/reference.ts';
import { buildReferencePage, formatSection, formatTable, formatText } from '#docs/reference/markdown.ts';
import { type ReferencePage } from '#docs/types/pages.ts';
import { type CommandReference } from '#docs/types/reference.ts';

function formatChoices(value: Pick<CommandReference['arguments'][number], 'choices' | 'default'>): string {
    const choices =
        value.choices === undefined
            ? ''
            : ' Choices: ' + value.choices.map((choice) => `\`${choice}\``).join(', ') + '.';
    const shown = typeof value.default === 'string' ? value.default : JSON.stringify(value.default);
    const defaultValue = value.default === undefined ? '' : ` Default: \`${shown}\`.`;
    return choices + defaultValue;
}

function formatCommand(command: CommandReference): string {
    const argumentRows = command.arguments.map((argument) => [
        `\`${argument.name}\``,
        `${argument.description}. ${argument.required ? 'Required.' : 'Optional.'}` + formatChoices(argument),
    ]);
    const globalOptions: Readonly<Record<string, string>> = CLI_REFERENCE.globalOptions;
    const optionRows = command.options
        .filter((option) => globalOptions[option.flags] !== option.description)
        .map((option) => [`\`${option.flags}\``, `${option.description}.` + formatChoices(option)]);
    const blocks = [
        formatText(command.description),
        `\`\`\`shell\n${command.usage}\n\`\`\``,
        formatTable(['Argument', DEFINITION_HEADING], argumentRows),
        formatTable(['Option', PURPOSE_HEADING], optionRows),
        formatTable(
            [EXIT_CODE_HEADING, 'Meaning'],
            command.exitCodes.map(([codes, meaning]) => [`\`${codes}\``, meaning]),
        ),
        ...(command.example === `gspot ${command.name}`
            ? []
            : [EXAMPLE_MESSAGE, `\`\`\`shell\n${command.example}\n\`\`\``]),
    ];
    return formatSection(`gspot ${command.name}`, blocks.filter(Boolean).join('\n\n'));
}

/**
Build the Commands page from the CLI help data, with a section per command in program order.
*/
export function buildCommandPage(): ReferencePage {
    const { commands } = CLI_REFERENCE;
    const commandRows = commands.map((command) => [
        `[\`gspot ${command.name}\`](#gspot-${command.name})`,
        command.summary,
    ]);
    const globalOptions = Object.entries(CLI_REFERENCE.globalOptions).map(([flags, description]) => [
        `\`${flags}\``,
        description + '.',
    ]);
    const exitCodes = CLI_REFERENCE.exitCodes.map(([codes, meaning]) => [`\`${codes}\``, meaning]);
    return buildReferencePage(
        'Commands',
        COMMANDS_DESCRIPTION,
        COMMANDS_OPENING +
            formatTable(['Command', PURPOSE_HEADING], commandRows) +
            '\n' +
            commands.map((command) => formatCommand(command)).join('') +
            formatSection(GLOBAL_OPTIONS_HEADING, formatTable(['Option', PURPOSE_HEADING], globalOptions)) +
            formatSection(
                EXIT_CODES_HEADING,
                `Every command exits with one of these codes.\n\n${formatTable([EXIT_CODE_HEADING, 'Meaning'], exitCodes)}`,
            ) +
            formatSection(
                ENVIRONMENT_VARIABLES_HEADING,
                formatTable(['Variable', PURPOSE_HEADING], ENVIRONMENT_VARIABLES),
            ),
    );
}
