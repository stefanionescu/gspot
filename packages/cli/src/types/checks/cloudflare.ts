/** The installed Ajv compiler and its native validation diagnostics. */
export type SchemaCompiler = new (options: { allErrors: boolean; allowUnionTypes: boolean; strictSchema: boolean }) => {
    compile(schema: unknown): ((value: unknown) => boolean) & {
        errors?: { instancePath: string; keyword: string; message?: string }[] | null;
    };
};
