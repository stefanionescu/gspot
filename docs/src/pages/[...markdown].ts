import { buildMarkdownCopyPath } from '../agents.ts';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { entryToSimpleMarkdown } from 'starlight-llms-txt/markdown';

/**
List a Markdown copy for each docs page, at the page address plus index.md.

@returns one path per page
*/
export const getStaticPaths = (async () => {
    const pages = await getCollection('docs');
    return pages.flatMap((page) => {
        const copy = buildMarkdownCopyPath(page.id);
        return copy === undefined ? [] : { params: { markdown: copy.slice(1) }, props: { docsPage: page } };
    });
}) satisfies GetStaticPaths;

/**
Build the Markdown copy of one docs page: its title, its description, and its content.

@param context - the endpoint context with the page
@returns the Markdown
*/
export const GET: APIRoute<{ docsPage: CollectionEntry<'docs'> }> = async (context) => {
    const { docsPage } = context.props;
    const { title, description } = docsPage.data;
    const content = await entryToSimpleMarkdown(docsPage, context);
    const sections =
        description === undefined || content.startsWith(description)
            ? [`# ${title}`, content]
            : [`# ${title}`, `> ${description}`, content];
    return new Response(`${sections.join('\n\n')}\n`);
};
