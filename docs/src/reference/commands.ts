import type { ReferencePage } from '../types/reference.ts';
import type { ReferenceData } from '#cli/types/reference.ts';
import { escapeCell, formatTable, formatSection, buildReferencePage } from './markdown.ts';
import { EXIT_CODE_ROW, REFERENCE_FOLDERS, ENVIRONMENT_VARIABLES } from '../config/reference.ts';

type Command = ReferenceData['commands'][number];

function formatOptionValues(option: { choices?: string[]; default?: unknown }): string {
    return (
        (option.choices === undefined
            ? ''
            : ' Choices: ' + option.choices.map((value) => '`' + value + '`').join(', ') + '.') +
        (option.default === undefined ? '' : ` Default: \`${JSON.stringify(option.default)}\`.`)
    );
}

// The help text lists one status per line, and a long meaning continues on the next lines.
function formatExitCodes(text: string): string {
    const rows: [string, string][] = [];
    for (const line of text.split('\n')) {
        const row = EXIT_CODE_ROW.exec(line)?.groups;
        const last = rows.at(-1);
        if (row?.['codes'] !== undefined && row['meaning'] !== undefined) rows.push([row['codes'], row['meaning']]);
        else if (last !== undefined && line.trim() !== '') last[1] += ` ${line.trim()}`;
    }
    return formatTable(
        ['Exit code', 'Meaning'],
        rows.map(([codes, meaning]) => [`\`${codes}\``, escapeCell(meaning)]),
    );
}

// One section per command: what it does, how to call it, its arguments and options, and how it exits.
function formatCommand(command: Command): string {
    const argumentRows = command.arguments.map((argument) => [
        `\`${argument.name}\``,
        escapeCell(
            `${argument.description}. ${argument.required ? 'Required.' : 'Optional.'}` + formatOptionValues(argument),
        ),
    ]);
    // The global options list --help once for every command.
    const optionRows = command.options
        .filter((option) => option.flags !== '-h, --help')
        .map((option) => [`\`${option.flags}\``, escapeCell(`${option.description}.` + formatOptionValues(option))]);
    return formatSection(
        `gspot ${command.name}`,
        `${command.description}\n\n\`\`\`shell\n${command.usage}\n\`\`\`\n` +
            (argumentRows.length === 0 ? '' : `\n${formatTable(['Argument', 'What it is'], argumentRows)}\n`) +
            (optionRows.length === 0 ? '' : `\n${formatTable(['Option', 'What it does'], optionRows)}\n`) +
            `\n${formatExitCodes(command.exitCodes)}\n\nFor example:\n\n\`\`\`shell\n${command.example}\n\`\`\``,
    );
}

/**
 * Build the one Commands page from the CLI help data, with a section per command in program order.
 * @param data the CLI reference data
 * @param data.commands the help data the CLI registers
 * @param data.exitCodes the exit codes of every command
 * @returns the page, keyed by its Markdown path
 */
export function buildCommandPages({
    commands,
    exitCodes,
}: Pick<ReferenceData, 'commands' | 'exitCodes'>): Map<string, ReferencePage> {
    const page = buildReferencePage(
        'Commands',
        'Every gspot command, its options, and its exit codes.',
        `Run gspot from any folder in the repository; it finds the nearest \`gspot.toml\`. Start each command the way your repository runs gspot, such as \`npx gspot\` or \`mise exec -- gspot\`. See [Install](/start/install/#choose-how-to-install). Commands that change settings write generated files too.\n\n` +
            formatTable(
                ['Command', 'What it does'],
                commands.map((command) => [
                    `[\`gspot ${command.name}\`](#gspot-${command.name})`,
                    escapeCell(command.summary),
                ]),
            ) +
            '\n' +
            commands.map((command) => formatCommand(command)).join('') +
            formatSection(
                'Global options',
                formatTable(
                    ['Option', 'What it does'],
                    [
                        ['`--version`', 'Print the version.'],
                        ['`--help`', 'Print help.'],
                    ],
                ),
            ) +
            formatSection(
                'Exit codes',
                `Every command exits with one of these codes.\n\n${formatExitCodes(exitCodes)}`,
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
