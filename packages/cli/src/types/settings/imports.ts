export type WrittenImportRule = {
    name: string;
    paths: string[];
    can_also_import?: string[] | undefined;
    can_import?: string[] | undefined;
};

export type ImportRule = {
    name: string;
    paths: string[];
    can_also_import: string[];
    can_import?: string[] | undefined;
};
