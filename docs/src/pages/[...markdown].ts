import { findMarkdownCopy } from '../agents.ts';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { entryToSimpleMarkdown } from 'starlight-llms-txt/markdown';

/**
 * List a Markdown copy for each docs page, at the page address plus index.md.
 * @returns one path per page
 */
export const getStaticPaths = (async () => {
    const pages = await getCollection('docs');
    return pages.flatMap((entry) => {
        const copy = findMarkdownCopy(entry.id);
        return copy === undefined ? [] : [{ params: { markdown: copy.slice(1) }, props: { entry } }];
    });
}) satisfies GetStaticPaths;

/**
 * Write the Markdown copy of one docs page: its title, its description, and its content.
 * @param context - the endpoint context with the page
 * @returns the Markdown
 */
export const GET: APIRoute<{ entry: CollectionEntry<'docs'> }> = async (context) => {
    const { entry } = context.props;
    const { title, description } = entry.data;
    const content = await entryToSimpleMarkdown(entry, context);
    const parts = description === undefined ? [`# ${title}`, content] : [`# ${title}`, `> ${description}`, content];
    return new Response(`${parts.join('\n\n')}\n`);
};
