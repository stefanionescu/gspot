import type { Constraint, Node } from '@pgsql/types';

import {
    CONSTRAINT_SUFFIXES,
    DISABLED_OPTION_VALUES,
    SCHEMA_NAME_INDEX,
    SECURITY_INVOKER_OPTION,
} from '#cli/config/configurations/infrastructure.ts';
import {
    applyAlterFunction,
    applyCreateFunction,
    dropFunctions,
} from '#cli/configurations/database/postgres/checks/functions.ts';
import {
    applyAlterPolicy,
    applyCreatePolicy,
    dropPolicy,
    qualifyName,
} from '#cli/configurations/database/postgres/checks/policies.ts';
import { applyRename, renameTable } from '#cli/configurations/database/postgres/checks/renames.ts';
import { findNodeFields, listNodeFields } from '#cli/parsers/code/sql.ts';
import type {
    Location,
    Migration,
    Schema,
    SchemaAlterations,
    SchemaState,
    SourceStatement,
    SqlStatementVisitors,
    StatementApplier,
} from '#cli/types/configurations/infrastructure.ts';
import type { SqlStatement } from '#cli/types/parsers.ts';

function removeTable(state: SchemaState, table: string): void {
    state.tables.delete(table);
    state.secured.delete(table);
    state.policies.delete(table);
    state.constraints.delete(table);
    state.indexes = state.indexes.filter((index) => index.table !== table);
}

function applyViewOptions(
    state: SchemaState,
    view: string,
    options: Node[] | undefined,
    source?: SourceStatement,
): void {
    const isInvoker = listNodeFields(options, 'DefElem').some(
        (option) =>
            option.defname === SECURITY_INVOKER_OPTION &&
            !DISABLED_OPTION_VALUES.has(findNodeFields(option.arg, 'String')?.sval ?? ''),
    );
    if (isInvoker) state.unprotectedViews.delete(view);
    else if (source !== undefined) state.unprotectedViews.set(view, source);
}

function buildConstraintName(node: Constraint, table: string, kind: string, keys: string[]): string {
    const constraintName = node.conname ?? '';
    if (constraintName !== '') return constraintName;
    const tableName = table.slice(table.indexOf('.') + 1);
    const suffix = CONSTRAINT_SUFFIXES[kind];
    return [tableName, ...(kind === 'CONSTR_PRIMARY' ? [] : keys), suffix].join('_');
}

function addForeignKey(state: SchemaState, location: Location, name: string, columns: string[]): void {
    const constraints = state.constraints.get(location.table) ?? new Map<string, Schema['foreignKeys'][number]>();
    constraints.set(name, {
        table: location.table,
        columns,
        path: location.migration.path,
        offset: location.statement.start,
        text: location.migration.text,
    });
    state.constraints.set(location.table, constraints);
}

function addConstraint(state: SchemaState, location: Location, node: Constraint, column?: string): void {
    const kind = node.contype ?? '';
    if (!Reflect.has(CONSTRAINT_SUFFIXES, kind)) return;
    const { keys, columns } =
        column === undefined
            ? {
                  keys: listNodeFields(node.keys, 'String').map((stringNode) => stringNode.sval ?? ''),
                  columns: listNodeFields(node.fk_attrs, 'String').map((stringNode) => stringNode.sval ?? ''),
              }
            : { keys: [column], columns: [column] };
    const isForeign = kind === 'CONSTR_FOREIGN';
    const name = buildConstraintName(node, location.table, kind, isForeign ? columns : keys);
    if (!isForeign && keys.length > 0)
        state.indexes.push({
            table: location.table,
            schema: location.table.slice(0, location.table.indexOf('.')),
            name,
            columns: keys,
            constraint: name,
        });
    if (isForeign) addForeignKey(state, location, name, columns);
}

const applyCreateTable: StatementApplier<'CreateStmt'> = (statement, state, migration) => {
    const table = qualifyName(statement.fields.relation?.schemaname, statement.fields.relation?.relname);
    if (state.tables.has(table) && statement.fields.if_not_exists === true) return;
    removeTable(state, table);
    const at = { migration, statement, table };
    state.tables.set(table, { path: migration.path, offset: statement.start, text: migration.text });
    const columns = listNodeFields(statement.fields.tableElts, 'ColumnDef');
    const inColumns = columns.flatMap((column) =>
        listNodeFields(column.constraints, 'Constraint').map((node) => ({ node, column: column.colname ?? '' })),
    );
    for (const inColumn of inColumns) addConstraint(state, at, inColumn.node, inColumn.column);
    const inTable = listNodeFields(statement.fields.tableElts, 'Constraint');
    for (const node of inTable) addConstraint(state, at, node);
};

const ALTERATIONS: SchemaAlterations = {
    AT_EnableRowSecurity: (state, at) => state.secured.add(at.table),
    AT_DisableRowSecurity: (state, at) => state.secured.delete(at.table),
    AT_DropConstraint: (state, at, command) => {
        const name = command.name ?? '';
        state.constraints.get(at.table)?.delete(name);
        state.indexes = state.indexes.filter((index) => index.table !== at.table || index.constraint !== name);
    },
    AT_AddColumn: (state, at, command) => {
        const column = findNodeFields(command.def, 'ColumnDef');
        const constraints = listNodeFields(column?.constraints, 'Constraint');
        for (const node of constraints) addConstraint(state, at, node, column?.colname ?? '');
    },
    AT_DropColumn: (state, at, command) => {
        const name = command.name ?? '';
        const constraints = state.constraints.get(at.table);
        if (constraints !== undefined)
            for (const [key, constraint] of constraints) if (constraint.columns.includes(name)) constraints.delete(key);
        state.indexes = state.indexes.filter((index) => index.table !== at.table || !index.columns.includes(name));
    },
    AT_AddConstraint: (state, at, command) => {
        const node = findNodeFields(command.def, 'Constraint');
        if (node !== undefined) addConstraint(state, at, node);
    },
    AT_SetRelOptions: (state, at, command) => {
        applyViewOptions(state, at.table, findNodeFields(command.def, 'List')?.items);
    },
};

const applyAlterTable: StatementApplier<'AlterTableStmt'> = (statement, state, migration) => {
    const at: Location = {
        migration,
        statement,
        table: qualifyName(statement.fields.relation?.schemaname, statement.fields.relation?.relname),
    };
    for (const command of listNodeFields(statement.fields.cmds, 'AlterTableCmd'))
        if (command.subtype !== undefined) ALTERATIONS[command.subtype]?.(state, at, command);
};

const DROP_APPLIERS: Partial<Record<string, (state: SchemaState, name: string, names: string[]) => void>> = {
    OBJECT_POLICY: dropPolicy,
    OBJECT_TABLE: (state, name) => {
        removeTable(state, name);
    },
    OBJECT_VIEW: (state, name) => {
        state.unprotectedViews.delete(name);
    },
    OBJECT_INDEX: (state, name) => {
        state.indexes = state.indexes.filter((index) => qualifyName(index.schema, index.name) !== name);
    },
};

const applyDrop: StatementApplier<'DropStmt'> = (statement, state) => {
    const { removeType: droppedKind = '' } = statement.fields;
    if (droppedKind === 'OBJECT_FUNCTION') dropFunctions(statement, state);
    for (const nodeField of listNodeFields(statement.fields.objects, 'List')) {
        const names = listNodeFields(nodeField.items, 'String').map((stringNode) => stringNode.sval ?? '');
        DROP_APPLIERS[droppedKind]?.(state, qualifyName(names.at(SCHEMA_NAME_INDEX), names.at(-1)), names);
    }
};

const STATEMENT_APPLIERS: SqlStatementVisitors<void, [SchemaState, Migration]> = {
    DropStmt: applyDrop,
    CreateStmt: applyCreateTable,
    AlterTableStmt: applyAlterTable,
    ViewStmt: (statement, state, migration) => {
        const view = qualifyName(statement.fields.view?.schemaname, statement.fields.view?.relname);
        applyViewOptions(state, view, statement.fields.options, {
            path: migration.path,
            offset: statement.start,
            text: migration.text,
        });
    },
    CreateFunctionStmt: applyCreateFunction,
    AlterFunctionStmt: applyAlterFunction,
    CreatePolicyStmt: applyCreatePolicy,
    AlterPolicyStmt: applyAlterPolicy,
    RenameStmt: applyRename,
    AlterObjectSchemaStmt: ({ fields }, state) => {
        if (fields.objectType === 'OBJECT_TABLE')
            renameTable(
                state,
                qualifyName(fields.relation?.schemaname, fields.relation?.relname),
                qualifyName(fields.newschema, fields.relation?.relname),
            );
    },
    IndexStmt: (statement, state) => {
        if (statement.fields.whereClause !== undefined) return;
        const columns = listNodeFields(statement.fields.indexParams, 'IndexElem').map((column) => column.name ?? '');
        if (columns.length === 0) return;
        const table = qualifyName(statement.fields.relation?.schemaname, statement.fields.relation?.relname);
        state.indexes.push({
            table,
            schema: statement.fields.relation?.schemaname,
            name: statement.fields.idxname ?? '',
            columns,
            constraint: '',
        });
    },
};

export function buildDatabaseSchema(migrations: Migration[]): Schema {
    const state: SchemaState = {
        indexes: [],
        constraints: new Map(),
        tables: new Map(),
        secured: new Set(),
        unprotectedViews: new Map(),
        policies: new Map(),
        functions: new Map(),
    };
    for (const migration of migrations)
        for (const statement of migration.statements) {
            const apply = STATEMENT_APPLIERS[statement.kind] as StatementApplier<SqlStatement['kind']> | undefined;
            apply?.(statement, state, migration);
        }
    const foreignKeys = state.constraints
        .values()
        .flatMap((constraints) => constraints.values().toArray())
        .toArray();
    const indexed = new Map<string, string[][]>();
    for (const index of state.indexes) {
        const columns = indexed.get(index.table) ?? [];
        columns.push(index.columns);
        indexed.set(index.table, columns);
    }
    return {
        tables: state.tables,
        secured: state.secured,
        unprotectedViews: state.unprotectedViews,
        foreignKeys,
        indexed,
        policies: state.policies,
        functions: state.functions,
    };
}
