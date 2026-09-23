import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// Astro emits its error route as 404.html even when ordinary pages use directory URLs.
export const onRequest = defineRouteMiddleware((context) => {
    if (context.locals.starlightRoute.id !== '404') return;
    const canonical = new URL('404.html', context.site).href;
    for (const entry of context.locals.starlightRoute.head) {
        if (entry.tag === 'link' && entry.attrs?.['rel'] === 'canonical') entry.attrs['href'] = canonical;
        if (entry.tag === 'meta' && entry.attrs?.['property'] === 'og:url') entry.attrs['content'] = canonical;
    }
});
