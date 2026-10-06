/** Valid schema inputs parse cleanly; refused inputs name their authored key. */
export type RuntimeSchemaCase = { name: string; input: Record<string, unknown> } & (
    | { valid: true; diagnostic?: never }
    | { valid: false; diagnostic: string }
);
