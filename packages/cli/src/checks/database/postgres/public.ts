// The documented migration layout: a boxed header with the file name and a purpose, boxed sections, and a labeled block above each table and function.
import { posix } from 'node:path';
import { memo } from '#cli/platform/memo.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { MIGRATION_VERSION } from '#cli/config/parsers/sql.ts';
import type { Migration } from '#cli/types/checks/postgres.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { migrationFiles } from '#cli/repository/selection/public.ts';
import { positionAt, parseSqlFile } from '#cli/parsers/sql/public.ts';

import {
    PURPOSE,
    SECTION,
    DOC_LABELS,
    LINE_ABOVE,
    BLOCK_REACH,
    HEADER_LINES,
    DOC_SEPARATOR,
    MIGRATION_DOWN,
    MIGRATION_STATEMENTS,
} from '#cli/config/checks/postgres.ts';

const MIGRATION_MEMO = { create: () => new Map<string, Promise<Migration[]>>() };

async function readMigrations(input: CheckInput, paths: string[]): Promise<Migration[]> {
    const migrations: Migration[] = [];
    for (const path of paths) {
        const original = readSource(input.root, path, input.reads).toString('utf8');
        const text = original.split(MIGRATION_DOWN, 1)[0] ?? '';
        const name = posix.basename(path);
        const parsed = await parseSqlFile(text, input.reads);
        if (parsed.error !== undefined)
            throw new Error(
                `${path}:${String(parsed.error.line)}:${String(parsed.error.column)}: the SQL does not parse: ${parsed.error.text}`,
            );
        migrations.push({
            path,
            name,
            version: MIGRATION_VERSION.exec(name)?.groups?.['version'] ?? '',
            text,
            statements: parsed.statements,
        });
    }
    return migrations;
}

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
                'Put the migration header between separator lines.',
            ),
        );
    const wanted = `-- Migration: ${migration.name}`;
    if (lines[1] !== wanted)
        findings.push(
            findingAt(input, { file: migration.path, line: 2 }, 'header', `Write "${wanted}" on the second line.`),
        );
    if (!PURPOSE.test(lines[3] ?? ''))
        findings.push(
            findingAt(
                input,
                { file: migration.path, line: HEADER_LINES },
                'header',
                'Start the fourth line with "-- Purpose:".',
            ),
        );
    return findings;
}

function sectionFindings(
    input: Pick<CheckInput, 'check'>,
    migration: Migration,
    lines: string[],
    headings: Map<number, string>,
): Finding[] {
    return [...headings].flatMap(([index, name]): Finding[] => {
        if (lines[index - 1] === DOC_SEPARATOR && lines[index + 1] === DOC_SEPARATOR) return [];
        return [
            findingAt(
                input,
                { file: migration.path, line: index + 1 },
                'section',
                `Put the "${name}" heading between separator lines.`,
            ),
        ];
    });
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
    headings: Map<number, string>,
): Finding[] {
    return migration.statements.flatMap((statement): Finding[] => {
        const layout = MIGRATION_STATEMENTS[statement.kind];
        if (layout === undefined) return [];
        const { section: wanted, words } = layout;
        const { line } = positionAt(migration.text, statement.start);
        const findings: Finding[] = [];
        const section = [...headings].findLast(([index]) => index < line)?.[1];
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
 * Reads and parses every tracked migration in version order.
 * @param input the check input
 * @returns the migrations, empty when the repository has no migrations folder
 */
export async function migrationsOf(input: CheckInput): Promise<Migration[]> {
    const paths = migrationFiles(
        input.view.options('postgres').migrations_folder,
        input.selection.selected,
        input.files,
        input.scope,
        input.view.test_files,
    )
        .filter((file) => !file.path.endsWith('.down.sql'))
        .map((file) => file.path);
    if (paths.length === 0) return [];
    const folders = memo(input.reads, MIGRATION_MEMO);
    const key = JSON.stringify(paths);
    let migrations = folders.get(key);
    if (migrations === undefined) {
        migrations = readMigrations(
            input,
            paths
                .map((path) => ({
                    path,
                    version: BigInt(MIGRATION_VERSION.exec(posix.basename(path))?.groups?.['version'] ?? '0'),
                }))
                .toSorted((left, right) => {
                    if (left.version === right.version) return left.path.localeCompare(right.path);
                    return left.version < right.version ? -1 : 1;
                })
                .map((entry) => entry.path),
        );
        folders.set(key, migrations);
    }
    return migrations;
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
    const headings = new Map<number, string>();
    for (const [index, line] of lines.entries()) {
        const name = SECTION.exec(line)?.groups?.['name'];
        if (name !== undefined && sections.includes(name)) headings.set(index, name);
    }
    return [
        ...headerFindings(input, migration, lines),
        ...sectionFindings(input, migration, lines, headings),
        ...statementFindings(input, migration, lines, headings),
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
