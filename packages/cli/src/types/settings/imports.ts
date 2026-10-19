export type WrittenImportRule = {
    name: string;
    paths: string[];
    can_also_import?: string[] | undefined;
    can_import?: string[] | undefined;
};

/**
 * One import rule. Its files may import its own files and the files of every rule above it, plus can_also_import.
 * can_import replaces that: the files may import their own files and exactly those rules.
 */
export type ImportRule = {
    name: string;
    paths: string[];
    can_also_import: string[];
    can_import?: string[] | undefined;
};
