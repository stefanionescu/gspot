import type { ReferencePage } from '../types/reference.ts';
import type { ReferenceData } from '#cli/types/reference.ts';
import { REFERENCE_FOLDERS, ENVIRONMENT_VARIABLES } from '../config/reference.ts';
import { GLOBAL_OPTIONS, PROGRAM_EXIT_CODES } from '#cli/config/commands/help.ts';
import { formatCode, escapeCell, formatTable, formatSection, buildReferencePage } from './markdown.ts';

type Command = ReferenceData['commands'][number];

function formatOptionValues(option: { choices?: string[]; default?: unknown }): string {
    return (
        (option.choices === undefined
            ? ''
            : ' Choices: ' + option.choices.map((value) => formatCode(value)).join(', ') + '.') +
        (option.default === undefined ? '' : ` Default: ${formatCode(JSON.stringify(option.default))}.`)
    );
}

// One section per command: what it does, how to call it, its arguments and options, and how it exits.
function formatCommand(command: Command): string {
    const argumentRows = command.arguments.map((argument) => [
        formatCode(argument.name),
        escapeCell(
            `${argument.description}. ${argument.required ? 'Required.' : 'Optional.'}` + formatOptionValues(argument),
        ),
    ]);
    // The global options list --help once for every command.
    const optionRows = command.options
        .filter((option) => !(option.flags in GLOBAL_OPTIONS))
        .map((option) => [formatCode(option.flags), escapeCell(`${option.description}.` + formatOptionValues(option))]);
    return formatSection(
        `gspot ${command.name}`,
        `${command.description}\n\n\`\`\`shell\n${command.usage}\n\`\`\`\n` +
            (argumentRows.length === 0 ? '' : `\n${formatTable(['Argument', 'What it is'], argumentRows)}\n`) +
            (optionRows.length === 0 ? '' : `\n${formatTable(['Option', 'What it does'], optionRows)}\n`) +
            `\n${formatTable(
                ['Exit code', 'Meaning'],
                command.exitCodes.map(([codes, meaning]) => [formatCode(codes), escapeCell(meaning)]),
            )}\n\nFor example:\n\n\`\`\`shell\n${command.example}\n\`\`\``,
    );
}

/**
 * Build the one Commands page from the CLI help data, with a section per command in program order.
 *
 * @param data the CLI reference data
 * @param data.commands the help data the CLI registers
 * @returns the page, keyed by its Markdown path
 */
export function buildCommandPages({ commands }: Pick<ReferenceData, 'commands'>): Map<string, ReferencePage> {
    const page = buildReferencePage(
        'Commands',
        'Every gspot command, its options, and its exit codes.',
        `Run gspot from any folder in the repository; it finds the nearest \`gspot.toml\`. Start each command the way your repository runs gspot, such as \`npx gspot\` or \`mise exec -- gspot\`. See [Install](/start/install/#choose-how-to-install). Commands that change settings write generated files too.\n\n` +
            formatTable(
                ['Command', 'What it does'],
                commands.map((command) => [
                    `[${formatCode('gspot ' + command.name)}](#gspot-${command.name})`,
                    escapeCell(command.summary),
                ]),
            ) +
            '\n' +
            commands.map((command) => formatCommand(command)).join('') +
            formatSection(
                'Global options',
                formatTable(
                    ['Option', 'What it does'],
                    Object.entries(GLOBAL_OPTIONS).map(([flags, description]) => [
                        formatCode(flags),
                        escapeCell(description + '.'),
                    ]),
                ),
            ) +
            formatSection(
                'Exit codes',
                `Every command exits with one of these codes.\n\n${formatTable(
                    ['Exit code', 'Meaning'],
                    PROGRAM_EXIT_CODES.map(([codes, meaning]) => [formatCode(codes), escapeCell(meaning)]),
                )}`,
            ) +
            formatSection(
                'Environment variables',
                formatTable(
                    ['Variable', 'What it does'],
                    ENVIRONMENT_VARIABLES.map(([name, meaning]) => [name, meaning]),
                ),
            ),
    );
    return new Map([[`${REFERENCE_FOLDERS.commands}/index.md`, page]]);
}
