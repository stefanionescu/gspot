export type WrittenImportRule = { name: string; paths: string[]; can_also_import?: string[] | undefined };

/** One import rule: its files may import the files of every rule above it, and of the rules in can_also_import. */
export type ImportRule = { name: string; paths: string[]; can_also_import: string[] };
