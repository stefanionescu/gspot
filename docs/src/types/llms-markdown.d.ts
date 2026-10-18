declare module 'starlight-llms-txt/markdown' {
    import type { APIContext } from 'astro';
    import type { CollectionEntry } from 'astro:content';

    /**
     * Render a docs page and convert it to Markdown, as llms-full.txt does.
     * @param entry - the docs page
     * @param context - the endpoint context
     * @param shouldMinify - drop asides and details, as llms-small.txt does
     * @returns the Markdown
     */
    export function entryToSimpleMarkdown(
        entry: CollectionEntry<'docs'>,
        context: APIContext,
        shouldMinify?: boolean,
    ): Promise<string>;
}
