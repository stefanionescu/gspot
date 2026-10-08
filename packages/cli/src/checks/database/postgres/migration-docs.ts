// The documented migration layout: a boxed header with the file name and a purpose, boxed sections, and a labeled block above each table and function.
import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { positionAt } from '#cli/parsers/sql/statements.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { Migration } from '#cli/types/checks/database/postgres.ts';
import { migrationsOf } from '#cli/checks/database/postgres/migrations.ts';

import {
    PURPOSE,
    SECTION,
    DOC_LABELS,
    LINE_ABOVE,
    BLOCK_REACH,
    HEADER_LINES,
    DOC_SEPARATOR,
    MIGRATION_STATEMENTS,
} from '#cli/config/checks/database/postgres.ts';

function headerFindings(input: Pick<CheckInput, 'check'>, migration: Migration, lines: string[]): Finding[] {
    const findings: Finding[] = [];
    const isBoxed =
        lines[0] === DOC_SEPARATOR && lines[2] === DOC_SEPARATOR && lines.slice(HEADER_LINES).includes(DOC_SEPARATOR);
    if (!isBoxed)
        findings.push(
            findingAt(
                input,
                { file: migration.path, line: 1 },
                'header',
                'The migration header sits between separator lines.',
            ),
        );
    const wanted = `-- Migration: ${migration.name}`;
    if (lines[1] !== wanted)
        findings.push(findingAt(input, { file: migration.path, line: 2 }, 'header', `The second line is "${wanted}".`));
    if (!PURPOSE.test(lines[3] ?? ''))
        findings.push(
            findingAt(
                input,
                { file: migration.path, line: HEADER_LINES },
                'header',
                'The fourth line starts with "-- Purpose:".',
            ),
        );
    return findings;
}

function sectionFindings(
    input: Pick<CheckInput, 'check'>,
    migration: Migration,
    lines: string[],
    sections: Set<string>,
): Finding[] {
    return lines.flatMap((line, index): Finding[] => {
        const name = SECTION.exec(line)?.groups?.['name'];
        if (name === undefined || !sections.has(name)) return [];
        if (lines[index - 1] === DOC_SEPARATOR && lines[index + 1] === DOC_SEPARATOR) return [];
        return [
            findingAt(
                input,
                { file: migration.path, line: index + 1 },
                'section',
                `The "${name}" heading sits between separator lines.`,
            ),
        ];
    });
}

function sectionAbove(lines: string[], line: number, sections: Set<string>): string | undefined {
    for (let index = line - 1; index >= 0; index -= 1) {
        const name = SECTION.exec(lines[index] ?? '')?.groups?.['name'];
        if (name !== undefined && sections.has(name)) return name;
    }
    return undefined;
}

// The comment lines directly above a statement, nearest first, reaching past blank lines.
function commentsAbove(lines: string[], line: number): string[] {
    const found: string[] = [];
    for (let index = line - LINE_ABOVE; index >= Math.max(0, line - LINE_ABOVE - BLOCK_REACH); index -= 1) {
        const text = (lines[index] ?? '').trim();
        if (text === '') continue;
        if (!text.startsWith('--')) break;
        found.push(text);
    }
    return found;
}

function statementFindings(
    input: Pick<CheckInput, 'check'>,
    migration: Migration,
    lines: string[],
    sections: Set<string>,
): Finding[] {
    return migration.statements.flatMap((statement): Finding[] => {
        const layout = MIGRATION_STATEMENTS[statement.kind];
        if (layout === undefined) return [];
        const { section: wanted, words } = layout;
        const { line } = positionAt(migration.text, statement.start);
        const findings: Finding[] = [];
        const section = sectionAbove(lines, line, sections);
        if (section !== wanted)
            findings.push(
                findingAt(
                    input,
                    { file: migration.path, line },
                    'placement',
                    `${words} belongs under "${wanted}", and it is under "${section ?? 'no section'}".`,
                ),
            );
        const label = DOC_LABELS[statement.kind];
        const comments = commentsAbove(lines, line);
        const isLabeled =
            label === undefined ||
            (comments.some((text) => label.test(text)) && comments.some((text) => PURPOSE.test(text)));
        if (!isLabeled)
            findings.push(
                findingAt(
                    input,
                    { file: migration.path, line },
                    'label',
                    `${words} has no labeled block with a "-- Purpose:" line above it.`,
                ),
            );
        return findings;
    });
}

/**
 * The layout findings of one migration.
 * @param input the check identity
 * @param migration the migration
 * @param sections the section names a heading may carry
 * @returns findings with source files and line numbers
 */
export function docFindings(input: Pick<CheckInput, 'check'>, migration: Migration, sections: string[]): Finding[] {
    const lines = migration.text.split('\n');
    const known = new Set(sections);
    return [
        ...headerFindings(input, migration, lines),
        ...sectionFindings(input, migration, lines, known),
        ...statementFindings(input, migration, lines, known),
    ];
}

/**
 * The layout findings of every migration, when postgres.docs asks for the layout.
 * @param input the check input
 * @returns the findings
 */
export async function migrationDocs(input: CheckInput): Promise<Finding[]> {
    const tool = input.view.options('postgres');
    const sections = tool['doc_sections'];
    const migrations = await migrationsOf(input);
    return migrations.flatMap((migration) => docFindings(input, migration, sections));
}
