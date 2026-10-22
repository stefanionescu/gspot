import type { RangeVar, Constraint } from '@pgsql/types';
import type { SqlStatementVisitors } from '#cli/types/parsers/sql.ts';
import { getNodeFields, listNodeFields, visitStatement } from '#cli/parsers/sql/postgres.ts';
import { PUBLIC_SCHEMA, SCHEMA_PART_INDEX, CONSTRAINT_SUFFIXES } from '#cli/config/checks/postgres.ts';

import type {
    Schema,
    Location,
    Migration,
    DatabaseSchema,
    StatementReader,
    SchemaAlterations,
} from '#cli/types/checks/postgres.ts';

function buildRelationName(relation: RangeVar | undefined): string {
    const schema = relation?.schemaname ?? '';
    return `${schema === '' ? PUBLIC_SCHEMA : schema}.${relation?.relname ?? ''}`;
}

function removeTable(schema: DatabaseSchema, table: string): void {
    schema.tables.delete(table);
    schema.secured.delete(table);
    schema.constraints.delete(table);
    schema.indexes = schema.indexes.filter((index) => index.table !== table);
}

// The name Postgres gives an unnamed constraint: the table, the key columns except for a primary key, and a suffix.
function buildConstraintName(node: Constraint, table: string, kind: string, keys: string[]): string {
    const declared = node.conname ?? '';
    if (declared !== '') return declared;
    const tableName = table.slice(table.indexOf('.') + 1);
    const suffix = CONSTRAINT_SUFFIXES[kind];
    return [tableName, ...(kind === 'CONSTR_PRIMARY' ? [] : keys), suffix].join('_');
}

function addForeignKey(schema: DatabaseSchema, at: Location, name: string, columns: string[]): void {
    const constraints = schema.constraints.get(at.table) ?? new Map<string, Schema['foreignKeys']>();
    const keys = columns.map((column) => ({
        table: at.table,
        column,
        path: at.migration.path,
        offset: at.statement.start,
        text: at.migration.text,
    }));
    constraints.set(name, keys);
    schema.constraints.set(at.table, constraints);
}

// A primary or unique key counts as an index on its first column.
function addConstraint(schema: DatabaseSchema, at: Location, node: Constraint, column?: string): void {
    const kind = node.contype ?? '';
    if (!(kind in CONSTRAINT_SUFFIXES)) return;
    const { keys, columns } =
        column === undefined
            ? {
                  keys: listNodeFields(node.keys, 'String').map((part) => part.sval ?? ''),
                  columns: listNodeFields(node.fk_attrs, 'String').map((part) => part.sval ?? ''),
              }
            : { keys: [column], columns: [column] };
    const isForeign = kind === 'CONSTR_FOREIGN';
    const name = buildConstraintName(node, at.table, kind, isForeign ? columns : keys);
    const [first] = keys;
    if (!isForeign && first !== undefined)
        schema.indexes.push({ table: at.table, name, column: first, constraint: name });
    if (isForeign) addForeignKey(schema, at, name, columns);
}

const readCreateTable: StatementReader<'CreateStmt'> = (statement, schema, migration) => {
    const table = buildRelationName(statement.fields.relation);
    if (schema.tables.has(table) && statement.fields.if_not_exists === true) return;
    removeTable(schema, table);
    const at = { migration, statement, table };
    schema.tables.set(table, { path: migration.path, offset: statement.start, text: migration.text });
    const columns = listNodeFields(statement.fields.tableElts, 'ColumnDef');
    const inColumns = columns.flatMap((column) =>
        listNodeFields(column.constraints, 'Constraint').map((node) => ({ node, column: column.colname ?? '' })),
    );
    for (const entry of inColumns) addConstraint(schema, at, entry.node, entry.column);
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
    const at: Location = { migration, statement, table: buildRelationName(statement.fields.relation) };
    for (const command of listNodeFields(statement.fields.cmds, 'AlterTableCmd'))
        if (command.subtype !== undefined) ALTERATIONS[command.subtype]?.(schema, at, command);
};

// A dropped table leaves the schema, so no check reports it.
const readDrop: StatementReader<'DropStmt'> = (statement, schema) => {
    for (const item of listNodeFields(statement.fields.objects, 'List')) {
        const parts = listNodeFields(item.items, 'String').map((part) => part.sval ?? '');
        switch (statement.fields.removeType) {
            case 'OBJECT_TABLE': {
                removeTable(schema, `${parts.at(SCHEMA_PART_INDEX) ?? PUBLIC_SCHEMA}.${parts.at(-1) ?? ''}`);
                break;
            }
            case 'OBJECT_INDEX': {
                const name = `${parts.at(SCHEMA_PART_INDEX) ?? PUBLIC_SCHEMA}.${parts.at(-1) ?? ''}`;
                schema.indexes = schema.indexes.filter(
                    (index) => `${index.table.slice(0, index.table.indexOf('.'))}.${index.name}` !== name,
                );
                break;
            }
            default: {
                break;
            }
        }
    }
};

const TOKEN_MATCHERS: SqlStatementVisitors<void, [DatabaseSchema, Migration]> = {
    DropStmt: readDrop,
    CreateStmt: readCreateTable,
    AlterTableStmt: readAlterTable,
    IndexStmt: (statement, state) => {
        const [first] = listNodeFields(statement.fields.indexParams, 'IndexElem');
        const column = first?.name ?? '';
        if (column === '') return;
        const table = buildRelationName(statement.fields.relation);
        state.indexes.push({ table, name: statement.fields.idxname ?? '', column, constraint: '' });
    },
};

function buildDatabaseSchema(schema: DatabaseSchema): Schema {
    const foreignKeys = [...schema.constraints.values()].flatMap((constraints) => [...constraints.values()].flat());
    const indexed = new Map<string, Set<string>>();
    for (const index of schema.indexes) {
        const columns = indexed.get(index.table) ?? new Set<string>();
        columns.add(index.column);
        indexed.set(index.table, columns);
    }
    return { tables: schema.tables, secured: schema.secured, foreignKeys, indexed };
}

/**
 * Replays the parsed migrations in version order and collects the tables, foreign keys, indexed columns, and tables
 * with row security that they leave.
 *
 * @param migrations parsed SQL files in version order.
 * @returns the schema summary.
 */
export function buildSchema(migrations: Migration[]): Schema {
    const state: DatabaseSchema = {
        indexes: [],
        constraints: new Map(),
        tables: new Map(),
        secured: new Set(),
    };
    for (const migration of migrations)
        for (const statement of migration.statements) visitStatement(statement, TOKEN_MATCHERS, state, migration);
    return buildDatabaseSchema(state);
}
