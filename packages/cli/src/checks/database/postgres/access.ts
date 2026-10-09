// The access checks of the schema the migrations build: row security, grants, and definer functions.
import { findingAt } from '#cli/checks/finding.ts';
import { positionAt } from '#cli/parsers/sql/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { Migration } from '#cli/types/checks/postgres.ts';
import { nodeOf, nodesOf } from '#cli/parsers/sql/contracts.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { SqlStatementView } from '#cli/types/parsers/sql.ts';
import { frozenMigrationPaths } from '#cli/parsers/sql/migrations.ts';
import { migrationsOf } from '#cli/checks/database/postgres/public.ts';
import { buildSchema } from '#cli/checks/database/postgres/contracts.ts';

function isLooseDefiner(statement: SqlStatementView): boolean {
    if (statement.kind !== 'CreateFunctionStmt') return false;
    const options = nodesOf(statement.fields.options, 'DefElem');
    const isDefiner = options.some(
        (option) => option.defname === 'security' && nodeOf(option.arg, 'Boolean')?.boolval === true,
    );
    const hasPath = options.some(
        (option) => option.defname === 'set' && nodeOf(option.arg, 'VariableSetStmt')?.name === 'search_path',
    );
    return isDefiner && !hasPath;
}

function statementFindings(
    input: CheckInput,
    migrations: Migration[],
    rule: string,
    diagnostic: string,
    isWrong: (statement: SqlStatementView) => boolean,
): Finding[] {
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
 * One finding for each table in a client schema with row security off.
 * @param input the check input
 * @returns the findings
 */
export async function rls(input: CheckInput): Promise<Finding[]> {
    const schema = buildSchema(await migrationsOf(input));
    const schemas = new Set(input.view.options('postgres')['client_schemas']);
    return schema.tables
        .entries()
        .filter(([table]) => schemas.has(table.slice(0, table.indexOf('.'))) && !schema.secured.has(table))
        .map(([table, at]) =>
            findingAt(
                input,
                { file: at.path, ...positionAt(at.text, at.offset) },
                'row-security',
                `${table} does not have row level security enabled.`,
            ),
        )
        .toArray();
}

/**
 * One finding for each mutable migration that grants every privilege.
 * @param input the check input
 * @returns the findings
 */
export async function grants(input: CheckInput): Promise<Finding[]> {
    const migrations = await migrationsOf(input);
    const frozen = frozenMigrationPaths(
        migrations.map(({ path }) => path),
        input.view.options('postgres').frozen_through,
    );
    return statementFindings(
        input,
        migrations.filter(({ path }) => !frozen.has(path)),
        'grant-all',
        'GRANT ALL gives every privilege, present and future; name the privileges.',
        (statement: SqlStatementView): boolean => {
            return (
                statement.kind === 'GrantStmt' &&
                statement.fields.is_grant === true &&
                statement.fields.privileges === undefined
            );
        },
    );
}

/**
 * One finding for each SECURITY DEFINER function that sets no search_path.
 * @param input the check input
 * @returns the findings
 */
export async function definerSearchPath(input: CheckInput): Promise<Finding[]> {
    const diagnostic =
        'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.';
    return statementFindings(input, await migrationsOf(input), 'definer-search-path', diagnostic, isLooseDefiner);
}
