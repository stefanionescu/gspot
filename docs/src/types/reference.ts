// The types of the generated reference pages.

/** A generated reference page: its frontmatter fields and Markdown body. */
export type ReferencePage = {
    data: { title: string; description: string; editUrl: string };
    body: string;
};
