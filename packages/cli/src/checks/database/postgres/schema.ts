import type { Constraint } from '@pgsql/types';
import type { SqlStatementVisitors } from '#cli/types/parsers/code/sql.ts';
import { getNodeFields, listNodeFields, visitStatement } from '#cli/parsers/code/sql.ts';
import { PUBLIC_SCHEMA, SCHEMA_NAME_INDEX, CONSTRAINT_SUFFIXES } from '#cli/config/checks/database/postgres/schema.ts';

import type {
    Schema,
    Location,
    Migration,
    DatabaseSchema,
    StatementReader,
    SchemaAlterations,
} from '#cli/types/checks/postgres.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function qualifyName(schema: string | undefined, name: string | undefined = ''): string {
    return `${schema === undefined || schema === '' ? PUBLIC_SCHEMA : schema}.${name}`;
}

function removeTable(schema: DatabaseSchema, table: string): void {
    schema.tables.delete(table);
    schema.secured.delete(table);
    schema.constraints.delete(table);
    schema.indexes = schema.indexes.filter((index) => index.table !== table);
}

function renameTable(schema: DatabaseSchema, table: string, name: string): void {
    const renamed = `${table.slice(0, table.indexOf('.'))}.${name}`;
    const source = schema.tables.get(table);
    if (source !== undefined) {
        schema.tables.set(renamed, source);
        schema.tables.delete(table);
    }
    if (schema.secured.delete(table)) schema.secured.add(renamed);
    const constraints = schema.constraints.get(table);
    if (constraints !== undefined) {
        schema.constraints.set(
            renamed,
            new Map([...constraints].map(([constraint, key]) => [constraint, { ...key, table: renamed }])),
        );
        schema.constraints.delete(table);
    }
    schema.indexes = schema.indexes.map((index) => (index.table === table ? { ...index, table: renamed } : index));
}

function buildConstraintName(node: Constraint, table: string, kind: string, keys: string[]): string {
    const constraintName = node.conname ?? '';
    if (constraintName !== '') return constraintName;
    const tableName = table.slice(table.indexOf('.') + 1);
    const suffix = CONSTRAINT_SUFFIXES[kind];
    return [tableName, ...(kind === 'CONSTR_PRIMARY' ? [] : keys), suffix].join('_');
}

function addForeignKey(schema: DatabaseSchema, at: Location, name: string, columns: string[]): void {
    const constraints = schema.constraints.get(at.table) ?? new Map<string, Schema['foreignKeys'][number]>();
    constraints.set(name, {
        table: at.table,
        columns,
        path: at.migration.path,
        offset: at.statement.start,
        text: at.migration.text,
    });
    schema.constraints.set(at.table, constraints);
}

function addConstraint(schema: DatabaseSchema, at: Location, node: Constraint, column?: string): void {
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
    const name = buildConstraintName(node, at.table, kind, isForeign ? columns : keys);
    if (!isForeign && keys.length > 0)
        schema.indexes.push({
            table: at.table,
            schema: at.table.slice(0, at.table.indexOf('.')),
            name,
            columns: keys,
            constraint: name,
        });
    if (isForeign) addForeignKey(schema, at, name, columns);
}

const readCreateTable: StatementReader<'CreateStmt'> = (statement, schema, migration) => {
    const table = qualifyName(statement.fields.relation?.schemaname, statement.fields.relation?.relname);
    if (schema.tables.has(table) && statement.fields.if_not_exists === true) return;
    removeTable(schema, table);
    const at = { migration, statement, table };
    schema.tables.set(table, { path: migration.path, offset: statement.start, text: migration.text });
    const columns = listNodeFields(statement.fields.tableElts, 'ColumnDef');
    const inColumns = columns.flatMap((column) =>
        listNodeFields(column.constraints, 'Constraint').map((node) => ({ node, column: column.colname ?? '' })),
    );
    for (const inColumn of inColumns) addConstraint(schema, at, inColumn.node, inColumn.column);
    const inTable = listNodeFields(statement.fields.tableElts, 'Constraint');
    for (const node of inTable) addConstraint(schema, at, node);
};

const ALTERATIONS: SchemaAlterations = {
    AT_EnableRowSecurity: (state, at) => state.secured.add(at.table),
    AT_DisableRowSecurity: (state, at) => state.secured.delete(at.table),
    AT_DropConstraint: (state, at, command) => {
        const name = command.name ?? '';
        state.constraints.get(at.table)?.delete(name);
        state.indexes = state.indexes.filter((index) => index.table !== at.table || index.constraint !== name);
    },
    AT_AddConstraint: (state, at, command) => {
        const node = getNodeFields(command.def, 'Constraint');
        if (node !== undefined) addConstraint(state, at, node);
    },
};

const readAlterTable: StatementReader<'AlterTableStmt'> = (statement, schema, migration) => {
    const at: Location = {
        migration,
        statement,
        table: qualifyName(statement.fields.relation?.schemaname, statement.fields.relation?.relname),
    };
    for (const command of listNodeFields(statement.fields.cmds, 'AlterTableCmd'))
        if (command.subtype !== undefined) ALTERATIONS[command.subtype]?.(schema, at, command);
};

const readDrop: StatementReader<'DropStmt'> = (statement, schema) => {
    for (const nodeField of listNodeFields(statement.fields.objects, 'List')) {
        const names = listNodeFields(nodeField.items, 'String').map((stringNode) => stringNode.sval ?? '');
        switch (statement.fields.removeType) {
            case 'OBJECT_TABLE': {
                removeTable(schema, qualifyName(names.at(SCHEMA_NAME_INDEX), names.at(-1)));
                continue;
            }
            case 'OBJECT_INDEX': {
                const name = qualifyName(names.at(SCHEMA_NAME_INDEX), names.at(-1));
                schema.indexes = schema.indexes.filter((index) => qualifyName(index.schema, index.name) !== name);
                continue;
            }
            default: {
                continue;
            }
        }
    }
};

function renameColumn(schema: DatabaseSchema, table: string, previous: string | undefined, name: string): void {
    const keys = schema.constraints.get(table)?.values() ?? [];
    for (const key of keys) key.columns = key.columns.map((column) => (column === previous ? name : column));
    for (const index of schema.indexes) {
        if (index.table === table) index.columns = index.columns.map((column) => (column === previous ? name : column));
    }
}

const STATEMENT_READERS: SqlStatementVisitors<void, [DatabaseSchema, Migration]> = {
    DropStmt: readDrop,
    CreateStmt: readCreateTable,
    AlterTableStmt: readAlterTable,
    RenameStmt: ({ fields }, schema) => {
        const table = qualifyName(fields.relation?.schemaname, fields.relation?.relname);
        if (fields.renameType === 'OBJECT_TABLE') renameTable(schema, table, fields.newname ?? '');
        if (fields.renameType !== 'OBJECT_COLUMN') return;
        renameColumn(schema, table, fields.subname, fields.newname ?? '');
    },
    IndexStmt: (statement, state) => {
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

function buildDatabaseSchema(schema: DatabaseSchema): Schema {
    const foreignKeys = schema.constraints
        .values()
        .flatMap((constraints) => constraints.values().toArray())
        .toArray();
    const indexed = new Map<string, string[][]>();
    for (const index of schema.indexes) {
        const columns = indexed.get(index.table) ?? [];
        columns.push(index.columns);
        indexed.set(index.table, columns);
    }
    return { tables: schema.tables, secured: schema.secured, foreignKeys, indexed };
}

/**
Replays the parsed migrations in version order and collects the tables, foreign keys, indexed columns, and tables
with row security that they leave.

@param migrations parsed SQL files in version order.
@returns the schema summary.
*/
export function buildSchema(migrations: Migration[]): Schema {
    const state: DatabaseSchema = {
        indexes: [],
        constraints: new Map(),
        tables: new Map(),
        secured: new Set(),
    };
    for (const migration of migrations)
        for (const statement of migration.statements) visitStatement(statement, STATEMENT_READERS, state, migration);
    return buildDatabaseSchema(state);
}
