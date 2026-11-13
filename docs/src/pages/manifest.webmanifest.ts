import type { APIRoute } from 'astro';

import cliPackage from '#cli-package' with { type: 'json' };
import { BACKGROUND_COLOR, SITE_TITLE } from '#docs/config/site.ts';

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
