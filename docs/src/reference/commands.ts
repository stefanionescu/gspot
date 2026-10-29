import { CLI_REFERENCE } from './cli.ts';
import { GLOBAL_OPTIONS, PROGRAM_EXIT_CODES } from '#cli/config/main.ts';
import { formatTable, formatSection, buildReferencePage } from './markdown.ts';
import { type ReferencePage, type CommandReference } from '../types/reference.ts';

import {
    PURPOSE_HEADING,
    EXAMPLE_MESSAGE,
    COMMANDS_OPENING,
    EXIT_CODE_HEADING,
    DEFINITION_HEADING,
    EXIT_CODES_HEADING,
    COMMANDS_DESCRIPTION,
    ENVIRONMENT_VARIABLES,
    GLOBAL_OPTIONS_HEADING,
    ENVIRONMENT_VARIABLES_HEADING,
} from '../config/reference.ts';

function formatCommand(command: CommandReference): string {
    const argumentRows = command.arguments.map((argument) => [
        `\`${argument.name}\``,
        `${argument.description}. ${argument.required ? 'Required.' : 'Optional.'}` +
            ((argument.choices === undefined
                ? ''
                : ' Choices: ' + argument.choices.map((value) => `\`${value}\``).join(', ') + '.') +
                (argument.default === undefined ? '' : ` Default: \`${JSON.stringify(argument.default)}\`.`)),
    ]);
    const optionRows = command.options
        .filter((option) => !Object.hasOwn(GLOBAL_OPTIONS, option.flags))
        .map((option) => [
            `\`${option.flags}\``,
            `${option.description}.` +
                ((option.choices === undefined
                    ? ''
                    : ' Choices: ' + option.choices.map((value) => `\`${value}\``).join(', ') + '.') +
                    (option.default === undefined ? '' : ` Default: \`${JSON.stringify(option.default)}\`.`)),
        ]);
    const blocks = [
        command.description,
        `\`\`\`shell\n${command.usage}\n\`\`\``,
        formatTable(['Argument', DEFINITION_HEADING], argumentRows),
        formatTable(['Option', PURPOSE_HEADING], optionRows),
        formatTable(
            [EXIT_CODE_HEADING, 'Meaning'],
            command.exitCodes.map(([codes, meaning]) => [`\`${codes}\``, meaning]),
        ),
        EXAMPLE_MESSAGE,
        `\`\`\`shell\n${command.example}\n\`\`\``,
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
    const globalOptions = Object.entries(GLOBAL_OPTIONS).map(([flags, description]) => [
        `\`${flags}\``,
        description + '.',
    ]);
    const exitCodes = PROGRAM_EXIT_CODES.map(([codes, meaning]) => [`\`${codes}\``, meaning]);
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
