import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const CANONICAL_ATTRIBUTES: Record<string, { selector: string; value: string; target: string }> = {
    link: { selector: 'rel', value: 'canonical', target: 'href' },
    meta: { selector: 'property', value: 'og:url', target: 'content' },
};

// Astro emits its error route as 404.html even when ordinary pages use directory URLs.
export const onRequest = defineRouteMiddleware((context) => {
    if (context.locals.starlightRoute.id !== '404') return;
    const canonical = new URL('404.html', context.site).href;
    for (const entry of context.locals.starlightRoute.head) {
        const attribute = CANONICAL_ATTRIBUTES[entry.tag];
        if (attribute === undefined || entry.attrs?.[attribute.selector] !== attribute.value) continue;
        entry.attrs[attribute.target] = canonical;
    }
});
