export type WrittenImportRule = {
    name: string;
    paths: string[];
    can_import?: string[] | undefined;
};

export type ImportRule = {
    name: string;
    paths: string[];
    can_import?: string[] | undefined;
};
