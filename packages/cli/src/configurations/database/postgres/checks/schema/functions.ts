import type { SqlStatement } from '#cli/types/parsers.ts';
import type { Node, DefElem, TypeName } from '@pgsql/types';
import { PUBLIC_SCHEMA } from '#cli/config/configurations/postgres.ts';
import { findNodeFields, listNodeFields } from '#cli/parsers/code/sql.ts';
import type { SchemaState, FunctionSecurity, StatementApplier } from '#cli/types/configurations/database.ts';

function buildFunctionKey(names: Node[] | undefined, parameters: Array<TypeName | undefined>): string {
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
        security.definer = findNodeFields(action.arg, 'Boolean')?.boolval === true;
        return true;
    }
    const setting = findNodeFields(action.arg, 'VariableSetStmt');
    if (setting === undefined || action.defname !== 'set') return false;
    if (setting.name !== 'search_path' && setting.kind !== 'VAR_RESET_ALL') return false;
    security.path = setting.kind !== 'VAR_RESET' && setting.kind !== 'VAR_RESET_ALL';
    return true;
}

export const applyCreateFunction: StatementApplier<'CreateFunctionStmt'> = (statement, state, migration) => {
    const options = listNodeFields(statement.fields.options, 'DefElem');
    const parameters = listNodeFields(statement.fields.parameters, 'FunctionParameter')
        .filter(({ mode }) => mode !== 'FUNC_PARAM_OUT' && mode !== 'FUNC_PARAM_TABLE')
        .map(({ argType }) => argType);
    const security: FunctionSecurity = { migration, statement, definer: false, path: false };
    for (const option of options) setFunctionSecurity(security, option);
    state.functions.set(buildFunctionKey(statement.fields.funcname, parameters), security);
};

export const applyAlterFunction: StatementApplier<'AlterFunctionStmt'> = (statement, state, migration) => {
    const { fields } = statement;
    const key = buildFunctionKey(fields.func?.objname, listNodeFields(fields.func?.objargs, 'TypeName'));
    const security = state.functions.get(key) ?? { migration, statement, definer: false, path: false };
    for (const action of listNodeFields(fields.actions, 'DefElem')) {
        if (!setFunctionSecurity(security, action)) continue;
        security.migration = migration;
        security.statement = statement;
    }
    state.functions.set(key, security);
};

export function dropFunctions(statement: SqlStatement<'DropStmt'>, state: SchemaState): void {
    for (const dropped of listNodeFields(statement.fields.objects, 'ObjectWithArgs'))
        state.functions.delete(buildFunctionKey(dropped.objname, listNodeFields(dropped.objargs, 'TypeName')));
}
