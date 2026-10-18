/** A generated reference page and its Starlight frontmatter. */
export type ReferencePage = {
    data: {
        title: string;
        description: string;
        editUrl: false;
        tableOfContents?: { maxHeadingLevel: number };
    };
    body: string;
};

/** One plugin rule on the ESLint plugin page: its name, page, the configs that turn it on, and what it finds. */
export type PluginRule = { name: string; link: string; configs: string[]; summary: string };
