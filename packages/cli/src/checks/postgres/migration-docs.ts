// The documented migration layout: a boxed header with the file name and a purpose, boxed sections, and a labeled block above each table and function.
import { positionAt } from '#cli/parsers/sql/statements.ts';
import { HEADER_LINES } from '#cli/constants/checks/structure.ts';
import { migrationsOf } from '#cli/checks/postgres/migrations.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import type { DocProblem, Migration } from '#cli/types/checks/postgres.ts';

import {
    BLOCK_REACH,
    DOC_SEPARATOR,
    MIGRATION_DOC_LABELS,
    MIGRATION_DOC_SECTIONS,
    PURPOSE,
    SECTION,
    STATEMENT_WORDS,
} from '#cli/constants/checks/postgres.ts';

function headerProblems(migration: Migration, lines: string[]): DocProblem[] {
    const problems: DocProblem[] = [];
    const isBoxed =
        lines[0] === DOC_SEPARATOR && lines[2] === DOC_SEPARATOR && lines.slice(HEADER_LINES).includes(DOC_SEPARATOR);
    if (!isBoxed)
        problems.push({ line: 1, rule: 'header', text: 'The migration header sits between separator lines.' });
    const wanted = `-- Migration: ${migration.name}`;
    if (lines[1] !== wanted) problems.push({ line: 2, rule: 'header', text: `The second line is "${wanted}".` });
    if (!PURPOSE.test(lines[3] ?? ''))
        problems.push({ line: HEADER_LINES, rule: 'header', text: 'The fourth line starts with "-- Purpose:".' });
    return problems;
}

function sectionProblems(lines: string[], sections: Set<string>): DocProblem[] {
    return lines.flatMap((line, index): DocProblem[] => {
        const name = SECTION.exec(line)?.groups?.['name'];
        if (name === undefined || !sections.has(name)) return [];
        if (lines[index - 1] === DOC_SEPARATOR && lines[index + 1] === DOC_SEPARATOR) return [];
        return [{ line: index + 1, rule: 'section', text: `The "${name}" heading sits between separator lines.` }];
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
    for (let index = line - 2; index >= Math.max(0, line - 2 - BLOCK_REACH); index -= 1) {
        const text = (lines[index] ?? '').trim();
        if (text === '') continue;
        if (!text.startsWith('--')) break;
        found.push(text);
    }
    return found;
}

function statementProblems(migration: Migration, lines: string[], sections: Set<string>): DocProblem[] {
    return migration.statements.flatMap((statement): DocProblem[] => {
        const wanted = MIGRATION_DOC_SECTIONS[statement.kind];
        if (wanted === undefined) return [];
        const { line } = positionAt(migration.text, statement.start);
        const words = STATEMENT_WORDS[statement.kind] ?? statement.kind;
        const problems: DocProblem[] = [];
        const section = sectionAbove(lines, line, sections);
        if (section !== wanted)
            problems.push({
                line,
                rule: 'placement',
                text: `${words} belongs under "${wanted}", and it is under "${section ?? 'no section'}".`,
            });
        const label = MIGRATION_DOC_LABELS[statement.kind];
        const comments = commentsAbove(lines, line);
        const isLabeled =
            label === undefined ||
            (comments.some((text) => label.test(text)) && comments.some((text) => PURPOSE.test(text)));
        if (!isLabeled)
            problems.push({
                line,
                rule: 'label',
                text: `${words} has no labeled block with a "-- Purpose:" line above it.`,
            });
        return problems;
    });
}

/**
 * The layout problems of one migration.
 * @param migration the migration
 * @param sections the section names a heading may carry
 * @returns the problems, each with its line
 */
export function docProblems(migration: Migration, sections: string[]): DocProblem[] {
    const lines = migration.text.split('\n');
    const known = new Set(sections);
    return [
        ...headerProblems(migration, lines),
        ...sectionProblems(lines, known),
        ...statementProblems(migration, lines, known),
    ];
}

/**
 * The layout findings of every migration, when tools.postgres.migration_docs asks for the layout.
 * @param input the engine input
 * @returns the findings
 */
export async function migrationDocs(input: EngineInput): Promise<Finding[]> {
    const tool = input.view.tool('postgres');
    const sections = (tool['doc_sections'] as string[] | undefined) ?? Object.values(MIGRATION_DOC_SECTIONS);
    const migrations = await migrationsOf(input);
    return migrations.flatMap((migration) =>
        docProblems(migration, sections).map((problem) => ({
            check: input.spec.name,
            file: migration.path,
            line: problem.line,
            rule: problem.rule,
            message: problem.text,
            fixable: false,
        })),
    );
}
