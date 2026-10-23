import { MARKDOWN_TYPE } from './config/agents.ts';
import { buildMarkdownCopyPath } from './agents.ts';
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

export const onRequest = defineRouteMiddleware(({ locals }) => {
    const route = locals.starlightRoute;
    const href = buildMarkdownCopyPath(route.entry.id);
    if (href !== undefined) route.head.push({ tag: 'link', attrs: { rel: 'alternate', type: MARKDOWN_TYPE, href } });
});
