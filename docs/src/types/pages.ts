import type { MarkdownHeading } from 'astro';

export type ReferencePage = {
    data: {
        title: string;
        description: string;
        editUrl: false;
        tableOfContents?: { maxHeadingLevel: number } | false;
    };
    body: string;
    headings?: MarkdownHeading[];
};

export type ConfigurationGuide = { title: string; slug: string };
