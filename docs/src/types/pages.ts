import type { MarkdownHeading } from 'astro';

export type ReferencePage = {
    data: {
        title: string;
        description?: string;
        editUrl: false;
        tableOfContents?: false | { maxHeadingLevel: number };
    };
    body: string;
    headings?: MarkdownHeading[];
};

export type ConfigurationGuide = { title: string; slug: string };
