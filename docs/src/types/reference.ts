// The types of the generated reference pages.
import type { SettingDeclaration } from '#cli/types/configurations.ts';

/** A generated reference page: its frontmatter fields and Markdown body. */
export type ReferencePage = {
    data: { title: string; description: string; editUrl: string };
    body: string;
};

/** One setting default shared by the listed configuration owners. */
export type SettingVariant = { setting: SettingDeclaration; owners: string[] };

/** A node of the published JSON schema, as the loader walks it to name the keys a table accepts. */
export type SchemaNode = {
    type?: string;
    properties?: Record<string, SchemaNode>;
    items?: SchemaNode;
    additionalProperties?: SchemaNode | boolean;
    anyOf?: SchemaNode[];
};
