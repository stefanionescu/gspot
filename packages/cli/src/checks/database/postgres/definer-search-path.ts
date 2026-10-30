import { getPosition } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Node, DefElem, TypeName } from '@pgsql/types';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { getNodeFields, listNodeFields } from '#cli/parsers/code/sql.ts';
import { PUBLIC_SCHEMA } from '#cli/config/checks/database/postgres/schema.ts';
import { readParsedMigrations } from '#cli/checks/database/postgres/migrations.ts';
import type { SqlStatement, SqlStatementVisitors } from '#cli/types/parsers/code/sql.ts';
import type { Migration, FunctionSecurity } from '#cli/types/checks/database/postgres.ts';

import {
    SECURITY_DEFINER_MESSAGE,
    DEFINER_SEARCH_PATH_RULE,
} from '#cli/config/checks/database/postgres/definer-search-path.ts';

function buildFunctionKey(names: Node[] | undefined, parameters: (TypeName | undefined)[]): string {
    const path = listNodeFields(names, 'String').map(({ sval = '' }) => sval);
    const qualified = path.length === 1 ? [PUBLIC_SCHEMA, ...path] : path;
    return JSON.stringify([
        qualified,
        parameters.map((parameter) => [
            listNodeFields(parameter?.names, 'String').map(({ sval = '' }) => sval),
            (parameter?.arrayBounds?.length ?? 0) > 0,
        ]),
    ]);
}

function setFunctionSecurity(security: FunctionSecurity, action: DefElem): boolean {
    if (action.defname === 'security') {
        security.definer = getNodeFields(action.arg, 'Boolean')?.boolval === true;
        return true;
    }
    const setting = getNodeFields(action.arg, 'VariableSetStmt');
    if (action.defname !== 'set' || setting === undefined) return false;
    if (setting.name !== 'search_path' && setting.kind !== 'VAR_RESET_ALL') return false;
    security.path = setting.kind !== 'VAR_RESET' && setting.kind !== 'VAR_RESET_ALL';
    return true;
}

function listLooseDefiners(migrations: Migration[]): FunctionSecurity[] {
    const functions = new Map<string, FunctionSecurity>();
    const readers: SqlStatementVisitors<void, [Migration]> = {
        CreateFunctionStmt: (statement, migration) => {
            const options = listNodeFields(statement.fields.options, 'DefElem');
            const parameters = listNodeFields(statement.fields.parameters, 'FunctionParameter')
                .filter(({ mode }) => mode !== 'FUNC_PARAM_OUT' && mode !== 'FUNC_PARAM_TABLE')
                .map(({ argType }) => argType);
            const key = buildFunctionKey(statement.fields.funcname, parameters);
            functions.set(key, {
                migration,
                statement,
                definer: options.some(
                    (option) => option.defname === 'security' && getNodeFields(option.arg, 'Boolean')?.boolval === true,
                ),
                path: options.some(
                    (option) =>
                        option.defname === 'set' &&
                        getNodeFields(option.arg, 'VariableSetStmt')?.name === 'search_path',
                ),
            });
        },
        AlterFunctionStmt: (statement, migration) => {
            const { fields } = statement;
            const key = buildFunctionKey(fields.func?.objname, listNodeFields(fields.func?.objargs, 'TypeName'));
            const security = functions.get(key) ?? { migration, statement, definer: false, path: false };
            for (const action of listNodeFields(fields.actions, 'DefElem')) {
                if (!setFunctionSecurity(security, action)) continue;
                security.migration = migration;
                security.statement = statement;
            }
            functions.set(key, security);
        },
        DropStmt: ({ fields }) => {
            if (fields.removeType !== 'OBJECT_FUNCTION') return;
            for (const dropped of listNodeFields(fields.objects, 'ObjectWithArgs'))
                functions.delete(buildFunctionKey(dropped.objname, listNodeFields(dropped.objargs, 'TypeName')));
        },
    };
    for (const migration of migrations)
        for (const statement of migration.statements) {
            const read = readers[statement.kind] as
                | ((statement: SqlStatement, migration: Migration) => void)
                | undefined;
            read?.(statement, migration);
        }
    return [...functions.values()].filter((fn) => fn.definer && !fn.path);
}

/**
Reports each SECURITY DEFINER function that sets no search_path.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
*/
export async function checkPostgresDefinerSearchPath(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const message = SECURITY_DEFINER_MESSAGE;
    const migrations = await readParsedMigrations(session, planned);
    return listLooseDefiners(migrations).map(({ migration, statement }) => ({
        file: migration.path,
        ...getPosition(migration.text, statement.start),
        rule: DEFINER_SEARCH_PATH_RULE,
        message: message,
    }));
}
