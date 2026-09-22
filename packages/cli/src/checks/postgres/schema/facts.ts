// What the migrations declare, gathered across every file: tables, row security, policies, foreign keys and indexes.
import { DEFAULT_SCHEMA } from '#cli/checks/postgres/postgres-definitions.ts';
import type { SqlNode, SqlStatementView } from '#cli/readers/sql/types.ts';
import { nodesOf, partsOf, textOf } from '#cli/readers/sql/tree.ts';
import type { FactReader, Migration, SchemaFacts } from '#cli/checks/postgres/types.ts';

function qualified(relation: unknown): string {
    const node = (relation ?? {}) as SqlNode;
    return `${textOf(node['schemaname']) || DEFAULT_SCHEMA}.${textOf(node['relname'])}`;
}

function lead(facts: SchemaFacts, table: string, column: string | undefined): void {
    if (column === undefined || column === '') return;
    const known = facts.indexed.get(table) ?? new Set<string>();
    known.add(column);
    facts.indexed.set(table, known);
}

// The part before the last in a qualified name: the schema of a table.
const PARENT_PART = -2;
const KEY_KINDS = new Set(['CONSTR_PRIMARY', 'CONSTR_UNIQUE']);

// One constraint of a table: a foreign key is recorded, and a primary or unique key counts as an index on its first column.
function constraint(
    facts: SchemaFacts,
    at: { migration: Migration; statement: SqlStatementView; table: string },
    node: SqlNode,
    column?: string,
): void {
    const kind = textOf(node['contype']);
    const [first] = column === undefined ? partsOf(node['keys']) : [column];
    if (KEY_KINDS.has(kind)) lead(facts, at.table, first);
    if (kind !== 'CONSTR_FOREIGN') return;
    const columns = column === undefined ? partsOf(node['fk_attrs']) : [column];
    for (const name of columns)
        facts.foreignKeys.push({
            table: at.table,
            column: name,
            path: at.migration.path,
            offset: at.statement.start,
            text: at.migration.text,
        });
}

const created: FactReader = (facts, migration, statement) => {
    const table = qualified(statement.fields['relation']);
    const at = { migration, statement, table };
    facts.tables.set(table, { path: migration.path, offset: statement.start, text: migration.text });
    const columns = nodesOf(statement.fields['tableElts'], 'ColumnDef');
    const inColumns = columns.flatMap((column) =>
        nodesOf(column['constraints'], 'Constraint').map((node) => ({ node, column: textOf(column['colname']) })),
    );
    for (const entry of inColumns) constraint(facts, at, entry.node, entry.column);
    const inTable = nodesOf(statement.fields['tableElts'], 'Constraint');
    for (const node of inTable) constraint(facts, at, node);
};

const altered: FactReader = (facts, migration, statement) => {
    const table = qualified(statement.fields['relation']);
    const commands = nodesOf(statement.fields['cmds'], 'AlterTableCmd');
    for (const command of commands) {
        if (command['subtype'] === 'AT_EnableRowSecurity') facts.secured.add(table);
        if (command['subtype'] !== 'AT_AddConstraint') continue;
        const node = (command['def'] as SqlNode | undefined)?.['Constraint'] as SqlNode | undefined;
        if (node !== undefined) constraint(facts, { migration, statement, table }, node);
    }
};

// A dropped table leaves the facts, so the checks ask nothing of a table the schema does not hold.
const dropped: FactReader = (facts, _migration, statement) => {
    if (statement.fields['removeType'] !== 'OBJECT_TABLE') return;
    const objects = nodesOf(statement.fields['objects'], 'List');
    for (const item of objects) {
        const parts = partsOf(item['items']);
        const name = parts.at(-1) ?? '';
        const table = `${parts.length === 1 ? DEFAULT_SCHEMA : (parts.at(PARENT_PART) ?? DEFAULT_SCHEMA)}.${name}`;
        facts.tables.delete(table);
        facts.foreignKeys = facts.foreignKeys.filter((key) => key.table !== table);
    }
};

const READERS: Record<string, FactReader> = {
    DropStmt: dropped,
    CreateStmt: created,
    AlterTableStmt: altered,
    CreatePolicyStmt: (facts, _migration, statement) => facts.policed.add(qualified(statement.fields['table'])),
    IndexStmt: (facts, _migration, statement) => {
        const [first] = nodesOf(statement.fields['indexParams'], 'IndexElem');
        lead(facts, qualified(statement.fields['relation']), first?.['name'] as string | undefined);
    },
};

/**
 * Reads every migration in order and gathers what they declare.
 * @param migrations the migrations, in version order
 * @returns the facts
 */
export function schemaFacts(migrations: Migration[]): SchemaFacts {
    const facts: SchemaFacts = {
        tables: new Map(),
        secured: new Set(),
        policed: new Set(),
        foreignKeys: [],
        indexed: new Map(),
    };
    for (const migration of migrations)
        for (const statement of migration.statements) READERS[statement.kind]?.(facts, migration, statement);
    return facts;
}
