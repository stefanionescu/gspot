// Types of the postgres checks.
import type { SqlStatementView } from '#types/sql.ts';

/** One migration file, read and parsed. */
export type Migration = {
    path: string;
    name: string;
    /** The digits that lead the file name; empty when it has none. */
    version: string;
    text: string;
    statements: SqlStatementView[];
};

/** Where a fact was declared, so a finding points at it. */
export type Declared = { path: string; offset: number; text: string };

/** One foreign key column of a table. */
export type ForeignKey = Declared & { table: string; column: string };

/** What the migrations say about the schema, read across every file. */
export type SchemaFacts = {
    /** Qualified table name to where it was created. */
    tables: Map<string, Declared>;
    secured: Set<string>;
    policed: Set<string>;
    foreignKeys: ForeignKey[];
    /** Qualified table name to the leading column of each index and key on it. */
    indexed: Map<string, Set<string>>;
};

/** Reads one statement kind into the facts. */
export type FactReader = (facts: SchemaFacts, migration: Migration, statement: SqlStatementView) => void;

/** One layout problem of a documented migration. */
export type DocProblem = { line: number; rule: string; text: string };
