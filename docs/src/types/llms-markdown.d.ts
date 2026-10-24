declare module 'starlight-llms-txt/markdown' {
    import type { APIContext } from 'astro';
    import type { CollectionEntry } from 'astro:content';

    export function entryToSimpleMarkdown(
        page: CollectionEntry<'docs'>,
        context: APIContext,
        shouldMinify?: boolean,
    ): Promise<string>;
}
