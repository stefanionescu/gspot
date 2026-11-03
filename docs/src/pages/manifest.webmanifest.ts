import type { APIRoute } from 'astro';
import { SITE_TITLE } from '#docs/config/site.ts';
import cliPackage from '#cli-package' with { type: 'json' };

const BACKGROUND_COLOR = '#0b1020';

/**
Serve the web app manifest, which names the site and gives a home screen its icon.
*/
export const GET: APIRoute = () =>
    Response.json({
        name: SITE_TITLE,
        short_name: SITE_TITLE,
        description: cliPackage.description,
        start_url: '/',
        display: 'browser',
        background_color: BACKGROUND_COLOR,
        theme_color: BACKGROUND_COLOR,
        icons: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
