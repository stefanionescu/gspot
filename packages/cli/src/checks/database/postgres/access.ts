// The access checks of the schema the migrations build: row security, grants, and definer functions.
import { findingAt } from '#cli/checks/finding.ts';
import { computePosition } from '#cli/system/text.ts';
import type { Migration } from '#cli/types/checks/database.ts';
import type { SqlStatementView } from '#cli/types/parsers/sql.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import { selectFrozenMigrations } from '#cli/parsers/sql/migrations.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { getNodeFields, listNodeFields } from '#cli/parsers/sql/postgres.ts';

function isLooseDefiner(statement: SqlStatementView): boolean {
    if (statement.kind !== 'CreateFunctionStmt') return false;
    const options = listNodeFields(statement.fields.options, 'DefElem');
    const isDefiner = options.some(
        (option) => option.defname === 'security' && getNodeFields(option.arg, 'Boolean')?.boolval === true,
    );
    const hasPath = options.some(
        (option) => option.defname === 'set' && getNodeFields(option.arg, 'VariableSetStmt')?.name === 'search_path',
    );
    return isDefiner && !hasPath;
}

function statementFindings(
    input: CheckInput,
    migrations: Migration[],
    { rule, message, isWrong }: { rule: string; message: string; isWrong: (statement: SqlStatementView) => boolean },
): Finding[] {
    return migrations.flatMap((migration) =>
        migration.statements
            .filter((statement) => isWrong(statement))
            .map((statement) =>
                findingAt(
                    input,
                    { file: migration.path, ...computePosition(migration.text, statement.start) },
                    rule,
                    message,
                ),
            ),
    );
}

/**
 * One finding for each table in a client schema with row security off.
 * @param input the check input.
 * @returns the findings.
 */
export async function postgresRowLevelSecurity(input: CheckInput): Promise<Finding[]> {
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) return syntax;
    const schema = buildSchema(migrations);
    const schemas = new Set(input.scope.view.options('postgres')['client_schemas']);
    return schema.tables
        .entries()
        .filter(([table]) => schemas.has(table.slice(0, table.indexOf('.'))) && !schema.secured.has(table))
        .map(([table, at]) =>
            findingAt(
                input,
                { file: at.path, ...computePosition(at.text, at.offset) },
                'row-security',
                `${table} does not have row level security enabled.`,
            ),
        )
        .toArray();
}

/**
 * One finding for each mutable migration that grants every privilege.
 * @param input the check input.
 * @returns the findings.
 */
export async function postgresGrants(input: CheckInput): Promise<Finding[]> {
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) return syntax;
    const frozen = selectFrozenMigrations(
        migrations.map(({ path }) => path),
        input.scope.view.options('postgres').frozen_through,
    );
    return statementFindings(
        input,
        migrations.filter(({ path }) => !frozen.has(path)),
        {
            rule: 'grant-all',
            message: 'GRANT ALL gives every privilege, present and future; name the privileges.',
            isWrong: (statement: SqlStatementView): boolean => {
                return (
                    statement.kind === 'GrantStmt' &&
                    statement.fields.is_grant === true &&
                    statement.fields.privileges === undefined
                );
            },
        },
    );
}

/**
 * One finding for each SECURITY DEFINER function that sets no search_path.
 * @param input the check input.
 * @returns the findings.
 */
export async function postgresDefinerSearchPath(input: CheckInput): Promise<Finding[]> {
    const diagnostic =
        'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.';
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) return syntax;
    return statementFindings(input, migrations, {
        rule: 'definer-search-path',
        message: diagnostic,
        isWrong: isLooseDefiner,
    });
}
