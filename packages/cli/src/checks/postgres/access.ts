import { getPosition } from '#cli/system/text.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { getTable } from '#cli/settings/scope-settings.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildSchema } from '#cli/checks/postgres/schema.ts';
import type { SqlStatement } from '#cli/types/parsers/sql.ts';
import type { Migration } from '#cli/types/checks/postgres.ts';
import { selectFrozenMigrations } from '#cli/parsers/sql/migrations.ts';
import { readParsedMigrations } from '#cli/checks/postgres/migrations.ts';
import { getNodeFields, listNodeFields } from '#cli/parsers/sql/postgres.ts';

function isLooseDefiner(statement: SqlStatement): boolean {
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

function listMigrationStatements(migrations: Migration[]): { migration: Migration; statement: SqlStatement }[] {
    return migrations.flatMap((migration) => migration.statements.map((statement) => ({ migration, statement })));
}

/**
 * Reports each table in a client schema with row security off.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose migrations to read.
 * @returns the findings.
 */
export async function checkRowLevelSecurity(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const schema = buildSchema(migrations);
    const schemas = new Set(getTable(planned.scope.settings, 'postgres')['client_schemas']);
    return schema.tables
        .entries()
        .filter(([table]) => schemas.has(table.slice(0, table.indexOf('.'))) && !schema.secured.has(table))
        .map(([table, at]) =>
            buildFinding(
                planned,
                { file: at.path, ...getPosition(at.text, at.offset) },
                'row-security',
                `${table} does not have row level security enabled.`,
            ),
        )
        .toArray();
}

/**
 * Reports each grant of every privilege in a migration after the frozen ones.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose migrations to read.
 * @returns the findings.
 */
export async function checkPostgresGrants(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const frozen = selectFrozenMigrations(
        migrations.map(({ path }) => path),
        getTable(planned.scope.settings, 'postgres').frozen_through,
    );
    return listMigrationStatements(migrations.filter(({ path }) => !frozen.has(path)))
        .filter(
            ({ statement }) =>
                statement.kind === 'GrantStmt' &&
                statement.fields.is_grant === true &&
                statement.fields.privileges === undefined,
        )
        .map(({ migration, statement }) =>
            buildFinding(
                planned,
                { file: migration.path, ...getPosition(migration.text, statement.start) },
                'grant-all',
                'GRANT ALL gives every privilege, present and future; name the privileges.',
            ),
        );
}

/**
 * Reports each SECURITY DEFINER function that sets no search_path.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose migrations to read.
 * @returns the findings.
 */
export async function checkDefinerSearchPath(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const message =
        'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.';
    const migrations = await readParsedMigrations(session, planned);
    return listMigrationStatements(migrations)
        .filter(({ statement }) => isLooseDefiner(statement))
        .map(({ migration, statement }) =>
            buildFinding(
                planned,
                { file: migration.path, ...getPosition(migration.text, statement.start) },
                'definer-search-path',
                message,
            ),
        );
}
