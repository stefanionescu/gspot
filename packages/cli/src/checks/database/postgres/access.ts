import { getPosition } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Node, TypeName, GrantStmt } from '@pgsql/types';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import type { SqlStatementVisitors } from '#cli/types/parsers/code/sql.ts';
import { selectFrozenMigrations } from '#cli/parsers/code/sql/migrations.ts';
import { PUBLIC_SCHEMA } from '#cli/config/checks/database/postgres/schema.ts';
import { readParsedMigrations } from '#cli/checks/database/postgres/migrations.ts';
import type { Migration, MigrationStatement } from '#cli/types/checks/postgres.ts';
import { getNodeFields, listNodeFields, visitStatement } from '#cli/parsers/code/sql/postgres.ts';

function buildFunctionKey(names: Node[] | undefined, parameters: (TypeName | undefined)[]): string {
    const path = listNodeFields(names, 'String').map(({ sval }) => sval ?? '');
    const qualified = path.length === 1 ? [PUBLIC_SCHEMA, ...path] : path;
    return JSON.stringify([
        qualified,
        parameters.map((parameter) => [
            listNodeFields(parameter?.names, 'String').map(({ sval }) => sval ?? ''),
            (parameter?.arrayBounds?.length ?? 0) > 0,
        ]),
    ]);
}

function listLooseDefiners(migrations: Migration[]): Map<string, MigrationStatement> {
    const definers = new Map<string, MigrationStatement>();
    const readers: SqlStatementVisitors<void, [Migration]> = {
        CreateFunctionStmt: (statement, migration) => {
            const options = listNodeFields(statement.fields.options, 'DefElem');
            const isDefiner = options.some(
                (option) => option.defname === 'security' && getNodeFields(option.arg, 'Boolean')?.boolval === true,
            );
            const hasPath = options.some(
                (option) =>
                    option.defname === 'set' && getNodeFields(option.arg, 'VariableSetStmt')?.name === 'search_path',
            );
            const parameters = listNodeFields(statement.fields.parameters, 'FunctionParameter')
                .filter(({ mode }) => mode !== 'FUNC_PARAM_OUT' && mode !== 'FUNC_PARAM_TABLE')
                .map(({ argType }) => argType);
            const key = buildFunctionKey(statement.fields.funcname, parameters);
            if (isDefiner && !hasPath) definers.set(key, { migration, statement });
            else definers.delete(key);
        },
        AlterFunctionStmt: ({ fields }) => {
            const actions = listNodeFields(fields.actions, 'DefElem');
            if (
                actions.some(
                    (action) =>
                        action.defname === 'set' &&
                        getNodeFields(action.arg, 'VariableSetStmt')?.name === 'search_path',
                )
            )
                definers.delete(
                    buildFunctionKey(fields.func?.objname, listNodeFields(fields.func?.objargs, 'TypeName')),
                );
        },
        DropStmt: ({ fields }) => {
            if (fields.removeType !== 'OBJECT_FUNCTION') return;
            for (const dropped of listNodeFields(fields.objects, 'ObjectWithArgs'))
                definers.delete(buildFunctionKey(dropped.objname, listNodeFields(dropped.objargs, 'TypeName')));
        },
    };
    for (const migration of migrations)
        for (const statement of migration.statements) visitStatement(statement, readers, migration);
    return definers;
}

function listMigrationStatements(migrations: Migration[]): MigrationStatement[] {
    return migrations.flatMap((migration) => migration.statements.map((statement) => ({ migration, statement })));
}

/**
Reports each table in a client schema with row security off.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
@returns the findings.
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
Reports each grant of every privilege in a migration after the frozen ones.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
@returns the findings.
*/
export async function checkPostgresGrants(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const frozen = selectFrozenMigrations(
        migrations.map(({ path }) => path),
        getTable(planned.scope.settings, 'postgres').frozen_through,
    );
    return listMigrationStatements(migrations.filter(({ path }) => !frozen.has(path)))
        .filter(({ statement }) => {
            let grant: GrantStmt | undefined;
            if (statement.kind === 'GrantStmt') grant = statement.fields;
            else if (statement.kind === 'AlterDefaultPrivilegesStmt') grant = statement.fields.action;
            return grant?.is_grant === true && grant.privileges === undefined;
        })
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
Reports each SECURITY DEFINER function that sets no search_path.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
@returns the findings.
*/
export async function checkDefinerSearchPath(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const message =
        'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.';
    const migrations = await readParsedMigrations(session, planned);
    return listLooseDefiners(migrations)
        .values()
        .map(({ migration, statement }) =>
            buildFinding(
                planned,
                { file: migration.path, ...getPosition(migration.text, statement.start) },
                'definer-search-path',
                message,
            ),
        )
        .toArray();
}
