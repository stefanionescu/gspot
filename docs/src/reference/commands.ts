import { buildProgram } from '#cli/commands/program.ts';
import { REFERENCE_FOLDERS } from '../config/reference.ts';
import type { ReferencePage } from '../types/reference.ts';
import { cell, table, referencePage } from './markdown.ts';

/**
 * Build the command index and each command's exact help reference.
 * @returns pages keyed by their Markdown path
 */
export function commandPages(): Map<string, ReferencePage> {
    const program = buildProgram();
    const pages = new Map<string, ReferencePage>();
    for (const command of program.commands) {
        const name = command.name();
        pages.set(
            `${REFERENCE_FOLDERS.commands}/${name}.md`,
            referencePage(`gspot ${name}`, command.summary(), `\`\`\`text\n${command.helpInformation()}\n\`\`\`\n`),
        );
    }
    const rows = program.commands.map((command) => [
        `[\`gspot ${command.name()}\`](/reference/${REFERENCE_FOLDERS.commands}/${command.name()}/)`,
        cell(command.summary()),
    ]);
    pages.set(
        `${REFERENCE_FOLDERS.commands}/index.md`,
        referencePage(
            'Commands',
            'Every gspot command and what it does.',
            `Run gspot from any folder in the repository; it finds the nearest \`gspot.toml\`.
Use your repository's [start command](/guides/install/).
See [Exit codes and environment variables](/reference/exit-codes/).

${table(['Command', 'What it does'], rows)}

## Global options

${table(
    ['Flag', 'Meaning'],
    [
        ['`--version`', 'Print the version.'],
        ['`--help`', 'Print help.'],
    ],
)}
`,
        ),
    );
    return pages;
}
