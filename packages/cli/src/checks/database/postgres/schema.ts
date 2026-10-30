import type { Constraint } from '@pgsql/types';
import { getNodeFields, listNodeFields } from '#cli/parsers/code/sql.ts';
import type { SqlStatement, SqlStatementVisitors } from '#cli/types/parsers/code/sql.ts';
import { PUBLIC_SCHEMA, SCHEMA_NAME_INDEX, CONSTRAINT_SUFFIXES } from '#cli/config/checks/database/postgres/schema.ts';

import type {
    Schema,
    Location,
    Migration,
    SchemaState,
    StatementReader,
    SchemaAlterations,
} from '#cli/types/checks/database/postgres.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Ten schema readers in this file qualify a name with its schema through it.
function qualifyName(schema: string | undefined, name: string | undefined = ''): string {
    return `${schema === undefined || schema === '' ? PUBLIC_SCHEMA : schema}.${name}`;
}

function removeTable(state: SchemaState, table: string): void {
    state.tables.delete(table);
    state.secured.delete(table);
    state.constraints.delete(table);
    state.indexes = state.indexes.filter((index) => index.table !== table);
}

function renameTable(state: SchemaState, table: string, renamed: string): void {
    const source = state.tables.get(table);
    if (source !== undefined) {
        state.tables.set(renamed, source);
        state.tables.delete(table);
    }
    if (state.secured.delete(table)) state.secured.add(renamed);
    const constraints = state.constraints.get(table);
    if (constraints !== undefined) {
        state.constraints.set(
            renamed,
            new Map([...constraints].map(([constraint, key]) => [constraint, { ...key, table: renamed }])),
        );
        state.constraints.delete(table);
    }
    state.indexes = state.indexes.map((index) =>
        index.table === table ? { ...index, table: renamed, schema: renamed.slice(0, renamed.indexOf('.')) } : index,
    );
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

const readCreateTable: StatementReader<'CreateStmt'> = (statement, state, migration) => {
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
        const column = getNodeFields(command.def, 'ColumnDef');
        for (const node of listNodeFields(column?.constraints, 'Constraint'))
            addConstraint(state, at, node, column?.colname ?? '');
    },
    AT_DropColumn: (state, at, command) => {
        const name = command.name ?? '';
        const constraints = state.constraints.get(at.table);
        for (const [key, constraint] of constraints ?? [])
            if (constraint.columns.includes(name)) constraints?.delete(key);
        state.indexes = state.indexes.filter((index) => index.table !== at.table || !index.columns.includes(name));
    },
    AT_AddConstraint: (state, at, command) => {
        const node = getNodeFields(command.def, 'Constraint');
        if (node !== undefined) addConstraint(state, at, node);
    },
};

const readAlterTable: StatementReader<'AlterTableStmt'> = (statement, state, migration) => {
    const at: Location = {
        migration,
        statement,
        table: qualifyName(statement.fields.relation?.schemaname, statement.fields.relation?.relname),
    };
    for (const command of listNodeFields(statement.fields.cmds, 'AlterTableCmd'))
        if (command.subtype !== undefined) ALTERATIONS[command.subtype]?.(state, at, command);
};

const readDrop: StatementReader<'DropStmt'> = (statement, state) => {
    for (const nodeField of listNodeFields(statement.fields.objects, 'List')) {
        const names = listNodeFields(nodeField.items, 'String').map((stringNode) => stringNode.sval ?? '');
        const name = qualifyName(names.at(SCHEMA_NAME_INDEX), names.at(-1));
        if (statement.fields.removeType === 'OBJECT_TABLE') removeTable(state, name);
        else if (statement.fields.removeType === 'OBJECT_INDEX')
            state.indexes = state.indexes.filter((index) => qualifyName(index.schema, index.name) !== name);
    }
};

function renameColumn(state: SchemaState, table: string, previous: string | undefined, name: string): void {
    const keys = state.constraints.get(table)?.values() ?? [];
    for (const key of keys) key.columns = key.columns.map((column) => (column === previous ? name : column));
    for (const index of state.indexes) {
        if (index.table === table) index.columns = index.columns.map((column) => (column === previous ? name : column));
    }
}

function renameConstraint(state: SchemaState, table: string, previous: string, name: string): void {
    const constraints = state.constraints.get(table);

    const constraint = constraints?.get(previous);
    if (constraint !== undefined) {
        constraints?.delete(previous);
        constraints?.set(name, constraint);
    }
    for (const index of state.indexes) {
        if (index.table === table && index.constraint === previous) {
            index.constraint = name;
            index.name = name;
        }
    }
}

function renameIndex(state: SchemaState, previous: string, name: string): void {
    const index = state.indexes.find((otherIndex) => qualifyName(otherIndex.schema, otherIndex.name) === previous);
    if (index === undefined) return;
    index.name = name;
}

const STATEMENT_READERS: SqlStatementVisitors<void, [SchemaState, Migration]> = {
    DropStmt: readDrop,
    CreateStmt: readCreateTable,
    AlterTableStmt: readAlterTable,
    RenameStmt: ({ fields }, state) => {
        const { relation = {}, newname: name = '', subname: previous = '' } = fields;
        const table = qualifyName(relation.schemaname, relation.relname);
        if (fields.renameType === 'OBJECT_TABLE') renameTable(state, table, qualifyName(relation.schemaname, name));
        if (fields.renameType === 'OBJECT_INDEX') renameIndex(state, table, name);
        if (fields.renameType === 'OBJECT_TABCONSTRAINT') renameConstraint(state, table, previous, name);
        if (fields.renameType !== 'OBJECT_COLUMN') return;
        renameColumn(state, table, previous, name);
    },
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

/**
Replays the parsed migrations in version order and collects the tables, foreign keys, indexed columns, and tables
with row security that they leave.

@param migrations parsed SQL files in version order.
*/
export function buildDatabaseSchema(migrations: Migration[]): Schema {
    const state: SchemaState = {
        indexes: [],
        constraints: new Map(),
        tables: new Map(),
        secured: new Set(),
    };
    for (const migration of migrations)
        for (const statement of migration.statements) {
            const read = STATEMENT_READERS[statement.kind] as
                | ((statement: SqlStatement, state: SchemaState, migration: Migration) => void)
                | undefined;
            read?.(statement, state, migration);
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
    return { tables: state.tables, secured: state.secured, foreignKeys, indexed };
}
