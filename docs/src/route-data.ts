import { findMarkdownCopy } from './agents.ts';
import { MARKDOWN_TYPE } from './config/agents.ts';
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

/** Link each docs page to its Markdown copy, for agents that read the HTML. */
export const onRequest = defineRouteMiddleware(({ locals }) => {
    const route = locals.starlightRoute;
    const href = findMarkdownCopy(route.entry.id);
    if (href !== undefined) route.head.push({ tag: 'link', attrs: { rel: 'alternate', type: MARKDOWN_TYPE, href } });
});
