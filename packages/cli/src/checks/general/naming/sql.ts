import { positionAt } from '#cli/system/text.ts';
import { sqlTokens } from '#cli/parsers/sql/lexer.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { SqlNamed, Identifier } from '#cli/types/checks/general.ts';
import { createIdentifier } from '#cli/checks/general/naming/declarations.ts';
import { nodesOf, partsOf, parseSqlFile, readStatement } from '#cli/parsers/sql/postgres.ts';
import type { SqlFile, SqlStatementView, SqlStatementReaders } from '#cli/types/parsers/sql.ts';

import {
    SQL_NAME_TOKEN,
    SQL_QUALIFIED_NAME,
    SQL_PARAMETER_PREFIX,
    SQL_TABLE_PARAMETERS,
    SQL_DECLARATION_PREFIX,
} from '#cli/config/parsers/sql.ts';

function addedColumns({ fields }: SqlStatementView<'AlterTableStmt'>): SqlNamed[] {
    return nodesOf(fields.cmds, 'AlterTableCmd')
        .filter((command) => command.subtype === 'AT_AddColumn')
        .flatMap((command) =>
            nodesOf(command.def === undefined ? [] : [command.def], 'ColumnDef').map((column) => ({
                category: 'columns',
                name: column.colname ?? '',
                ...(column.location === undefined ? {} : { location: column.location }),
            })),
        );
}

const NAME_READERS: SqlStatementReaders<SqlNamed[]> = {
    CreateSchemaStmt: ({ fields }) => [{ category: 'schemas', name: fields.schemaname ?? '' }],
    CreateStmt: ({ fields }) => [
        {
            category: 'tables',
            name: fields.relation?.relname ?? '',
            ...(fields.relation?.location === undefined ? {} : { location: fields.relation.location }),
        },
        ...nodesOf(fields.tableElts, 'ColumnDef').map<SqlNamed>((column) => ({
            category: 'columns',
            name: column.colname ?? '',
            ...(column.location === undefined ? {} : { location: column.location }),
        })),
    ],
    ViewStmt: ({ fields }) => [
        {
            category: 'tables',
            name: fields.view?.relname ?? '',
            ...(fields.view?.location === undefined ? {} : { location: fields.view.location }),
        },
    ],
    AlterTableStmt: addedColumns,
    IndexStmt: ({ fields }) => [{ category: 'indexes', name: fields.idxname ?? '' }],
    CreateTrigStmt: ({ fields }) => [{ category: 'triggers', name: fields.trigname ?? '' }],
    CreatePolicyStmt: ({ fields }) => [{ category: 'policies', name: fields.policy_name ?? '' }],
};

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- reason: SQL declaration positions require literal spans, parameter boundaries, and parser locations; splitting these steps repeats scan state.
function parameterSpans(source: string, start: number): { spans: number[]; end: number } {
    const spans: number[] = [];
    const literals = new Map(
        [...sqlTokens(source.slice(start))].map((token) => [token.start + start, token.end + start]),
    );
    let span = start;
    let depth = 0;
    let at = start;
    while (at < source.length) {
        const literal = literals.get(at);
        if (literal !== undefined) {
            at = literal;
            continue;
        }
        const character = source[at];
        if (character === ')' && depth === 0) break;
        if (character === '(' || character === '[') depth += 1;
        else if (character === ')' || character === ']') depth -= 1;
        else if (character === ',' && depth === 0) {
            spans.push(span);
            span = at + 1;
        }
        at += 1;
    }
    if (source.slice(span, at).trim() !== '') spans.push(span);
    return { spans, end: at + 1 };
}

// eslint-disable-next-line complexity -- reason: SQL declaration positions require literal spans, parameter boundaries, and parser locations; splitting these steps repeats scan state.
function functionNames(statement: SqlStatementView<'CreateFunctionStmt'>, source: string): SqlNamed[] {
    let start = statement.start + (SQL_DECLARATION_PREFIX.exec(source.slice(statement.start))?.[0].length ?? 0);
    start += source.slice(start).length - source.slice(start).trimStart().length;
    const qualified = SQL_QUALIFIED_NAME.exec(source.slice(start))?.[0] ?? '';
    const lastPart = [...qualified.matchAll(SQL_NAME_TOKEN)].at(-1);
    const names: SqlNamed[] = [
        {
            category: 'functions',
            name: partsOf(statement.fields.funcname).at(-1) ?? '',
            offset: start + (lastPart?.index ?? 0),
        },
    ];
    const open = source.indexOf('(', start + qualified.length);
    const input = parameterSpans(source, open + 1);
    const output = SQL_TABLE_PARAMETERS.exec(source.slice(input.end));
    const spans =
        output === null ? input.spans : [...input.spans, ...parameterSpans(source, input.end + output[0].length).spans];
    for (const [index, parameter] of nodesOf(statement.fields.parameters, 'FunctionParameter').entries()) {
        const span = spans[index];
        if (span === undefined) continue;
        names.push({
            category: 'parameters',
            name: parameter.name ?? '',
            offset: span + (SQL_PARAMETER_PREFIX.exec(source.slice(span))?.[0].length ?? 0),
        });
    }
    return names;
}

function statementIdentifiers(
    file: string,
    source: string,
    statement: SqlStatementView,
    parsed: SqlFile,
    lexicalSource: string,
): Identifier[] {
    const named =
        statement.kind === 'CreateFunctionStmt'
            ? functionNames(statement, lexicalSource)
            : (readStatement(statement, NAME_READERS) ?? []);
    let offset = statement.start + (SQL_DECLARATION_PREFIX.exec(lexicalSource.slice(statement.start))?.[0].length ?? 0);
    return (
        named
            .filter((entry) => entry.name !== '')
            // eslint-disable-next-line sonarjs/cognitive-complexity, complexity -- reason: SQL declaration positions require literal spans, parameter boundaries, and parser locations; splitting these steps repeats scan state.
            .flatMap((entry): Identifier[] => {
                let found = -1;
                if (entry.offset !== undefined) found = entry.offset;
                else if (entry.location !== undefined && entry.location >= 0) {
                    found = Buffer.from(parsed.source).subarray(0, entry.location).toString('utf8').length;
                    if (entry.category === 'tables') {
                        const qualified = SQL_QUALIFIED_NAME.exec(lexicalSource.slice(found))?.[0] ?? '';
                        const last = [...qualified.matchAll(SQL_NAME_TOKEN)].at(-1);
                        if (last !== undefined) found += last.index;
                    }
                } else {
                    const nameMatch = [...lexicalSource.slice(offset).matchAll(SQL_NAME_TOKEN)].find((match) => {
                        const name = match[0];
                        return name.startsWith('"')
                            ? name.slice(1, -1).replaceAll('""', '"') === entry.name
                            : name.toLowerCase() === entry.name;
                    });
                    if (nameMatch !== undefined) found = offset + nameMatch.index;
                }
                if (found !== -1)
                    offset =
                        found + (SQL_QUALIFIED_NAME.exec(lexicalSource.slice(found))?.[0].length ?? entry.name.length);
                if (parsed.variables.some(({ start, end }) => found >= start && found < end)) return [];
                const identifierStart = found === -1 ? statement.start : found;
                const quoteWidth = source[identifierStart] === '"' ? 1 : 0;
                return [
                    createIdentifier(
                        { file, language: 'sql' },
                        {
                            ...positionAt(source, identifierStart + quoteWidth),
                            category: entry.category,
                            name: entry.name,
                        },
                    ),
                ];
            })
    );
}

/**
 * The identifiers a valid SQL file declares. Parse failures stop the analysis.
 * @param file the file path.
 * @param source the file text.
 * @param reads optional execution reads shared by SQL checks.
 * @returns the identifiers.
 */
export async function sqlIdentifiers(file: string, source: string, reads?: ReadCache): Promise<Identifier[]> {
    const parsed = await parseSqlFile(source, reads);
    if (parsed.error !== undefined)
        throw new Error(
            `${file}:${String(parsed.error.line)}:${String(parsed.error.column)}: SQL parse failed: ${parsed.error.text}`,
        );
    // eslint-disable-next-line unicorn/prefer-spread -- reason: SQL offsets count UTF-16 code units, including each surrogate half.
    const characters = parsed.source.split('');
    for (const token of sqlTokens(parsed.source))
        if (token.kind === 'line-comment' || token.kind === 'block-comment')
            characters.fill(' ', token.start, token.end);
    const lexicalSource = characters.join('');
    return parsed.statements.flatMap((statement) =>
        statementIdentifiers(file, source, statement, parsed, lexicalSource),
    );
}
