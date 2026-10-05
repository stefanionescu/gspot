// The access checks of the schema the migrations build: row security, grants, and definer functions.
import { nodesOf } from '#cli/parsers/sql/pg.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { positionAt } from '#cli/parsers/sql/statements.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import type { SqlNode, SqlStatementView } from '#cli/types/parsers/sql.ts';
import { migrationsOf } from '#cli/checks/database/postgres/migrations.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';

function isLooseDefiner(statement: SqlStatementView): boolean {
    if (statement.kind !== 'CreateFunctionStmt') return false;
    const options = nodesOf(statement.fields['options'], 'DefElem');
    const isDefiner = options.some(
        (option) =>
            option['defname'] === 'security' &&
            ((option['arg'] as SqlNode | undefined)?.['Boolean'] as SqlNode | undefined)?.['boolval'] === true,
    );
    const hasPath = options.some(
        (option) =>
            option['defname'] === 'set' &&
            ((option['arg'] as SqlNode | undefined)?.['VariableSetStmt'] as SqlNode | undefined)?.['name'] ===
                'search_path',
    );
    return isDefiner && !hasPath;
}

async function statementFindings(
    input: EngineInput,
    rule: string,
    diagnostic: string,
    isWrong: (statement: SqlStatementView) => boolean,
): Promise<Finding[]> {
    const migrations = await migrationsOf(input);
    return migrations.flatMap((migration) =>
        migration.statements
            .filter((statement) => isWrong(statement))
            .map((statement) =>
                findingAt(
                    input,
                    { file: migration.path, ...positionAt(migration.text, statement.start) },
                    rule,
                    diagnostic,
                ),
            ),
    );
}

/**
 * One finding for each table in a client schema with no row security, or with row security and no policy.
 * @param input the engine input
 * @returns the findings
 */
export async function rls(input: EngineInput): Promise<Finding[]> {
    const schema = buildSchema(await migrationsOf(input));
    const schemas = new Set(input.view.options('postgres')['client_schemas'] as string[]);
    return schema.tables
        .entries()
        .filter(([table]) => schemas.has(table.slice(0, table.indexOf('.'))))
        .flatMap(([table, at]): Finding[] => {
            const place = { file: at.path, ...positionAt(at.text, at.offset) };
            if (!schema.secured.has(table))
                return [findingAt(input, place, 'row-security', `${table} does not have row level security enabled.`)];
            if (schema.policed.has(table)) return [];
            return [findingAt(input, place, 'policy', `${table} enables row level security and has no policy.`)];
        })
        .toArray();
}

/**
 * One finding for each grant of every privilege.
 * @param input the engine input
 * @returns the findings
 */
export function grants(input: EngineInput): Promise<Finding[]> {
    return statementFindings(
        input,
        'grant-all',
        'GRANT ALL gives every privilege, present and future; name the privileges.',
        (statement: SqlStatementView): boolean => {
            return (
                statement.kind === 'GrantStmt' &&
                statement.fields['is_grant'] === true &&
                statement.fields['privileges'] === undefined
            );
        },
    );
}

/**
 * One finding for each SECURITY DEFINER function that sets no search_path.
 * @param input the engine input
 * @returns the findings
 */
export function definerSearchPath(input: EngineInput): Promise<Finding[]> {
    const diagnostic =
        'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.';
    return statementFindings(input, 'definer-search-path', diagnostic, isLooseDefiner);
}
