// The types of the generated reference pages.
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';

/** A generated reference page: its frontmatter fields and Markdown body. */
export type ReferencePage = {
    data: { title: string; description: string; editUrl: false };
    body: string;
};

/** One setting default shared by the listed configuration owners. */
export type SettingVariant = { setting: SettingDeclaration; owners: string[] };
