import type { ReferencePage } from '../types/reference.ts';
import type { ReferenceData } from '#cli/types/reference.ts';
import { EXIT_CODE_LINE, REFERENCE_FOLDERS, HELP_CONTINUATION } from '../config/reference.ts';
import { escapeCell, formatTable, formatSection, formatDefinitions, buildReferencePage } from './markdown.ts';

function formatOptionValues(option: { choices?: string[]; default?: unknown }): string {
    return (
        (option.choices === undefined
            ? ''
            : ' Choices: ' + option.choices.map((value) => '`' + value + '`').join(', ') + '.') +
        (option.default === undefined ? '' : ` Default: \`${JSON.stringify(option.default)}\`.`)
    );
}

// Keep statuses literal in the generated reference.
function formatExitCodes(text: string): string {
    return text.replaceAll(EXIT_CODE_LINE, '- `$1`: ').replaceAll(HELP_CONTINUATION, '  ');
}

/**
 * Build the command pages from the CLI help data, in program order.
 * @param data the CLI reference data
 * @param data.commands the help data the CLI registers
 * @param data.exitCodes the exit codes of every command
 * @returns pages keyed by their Markdown path
 */
export function buildCommandPages({
    commands,
    exitCodes,
}: Pick<ReferenceData, 'commands' | 'exitCodes'>): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>();
    for (const [order, command] of commands.entries()) {
        const argumentsBody = formatDefinitions(
            command.arguments.map((argument) => [
                `\`${argument.name}\``,
                `${argument.description}. ${argument.required ? 'Required.' : 'Optional.'}` +
                    formatOptionValues(argument),
            ]),
        );
        // The Commands index lists --help with the global options.
        const options = formatDefinitions(
            command.options
                .filter((option) => option.flags !== '-h, --help')
                .map((option) => [`\`${option.flags}\``, `${option.description}.` + formatOptionValues(option)]),
        );
        const page = buildReferencePage(
            `gspot ${command.name}`,
            command.summary,
            `${command.description}\n` +
                formatSection('Usage', `\`\`\`shell\n${command.usage}\n\`\`\``) +
                formatSection('Arguments', command.arguments.length === 0 ? '' : argumentsBody) +
                formatSection('Options', options) +
                formatSection('Exit codes', formatExitCodes(command.exitCodes)) +
                formatSection('Example', `\`\`\`shell\n${command.example}\n\`\`\``),
        );
        page.data.sidebar = { order: order + 1 };
        pages.set(`${REFERENCE_FOLDERS.commands}/${command.name}.md`, page);
    }
    const index = buildReferencePage(
        'Commands',
        'Every gspot command and what it does.',
        `Run gspot from any folder in the repository; it finds the nearest \`gspot.toml\`. Use your repository's [start command](/start/install/). Commands that change settings write generated files too.\n\n` +
            formatTable(
                ['Command', 'What it does'],
                commands.map((command) => [
                    `[\`gspot ${command.name}\`](/reference/commands/${command.name}/)`,
                    escapeCell(command.summary),
                ]),
            ) +
            formatSection(
                'Global options',
                formatTable(
                    ['Flag', 'Meaning'],
                    [
                        ['`--version`', 'Print the version.'],
                        ['`--help`', 'Print help.'],
                    ],
                ),
            ) +
            formatSection('Exit codes', formatExitCodes(exitCodes)) +
            '\nSee also [Environment variables](/reference/environment-variables/).\n',
    );
    index.data.sidebar = { order: 0 };
    pages.set(`${REFERENCE_FOLDERS.commands}/index.md`, index);
    return pages;
}
