// The static-site analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { siteBuilds, buildReproducible } from '#cli/checks/static-site/build.ts';
import { deadAssets, webManifest, svgCompressed, securityHeaders } from '#cli/checks/static-site/source-checks.ts';

import {
    sizeLimits,
    builtMarkup,
    deadSelectors,
    externalLinks,
    internalLinks,
    sitemapMatches,
} from '#cli/checks/static-site/output-checks.ts';

export const STATIC_SITE_ANALYSES: Record<string, Engine> = {
    'site-build': siteBuilds,
    'site-build-reproducible': buildReproducible,
    'site-built-markup': builtMarkup,
    'site-dead-selectors': deadSelectors,
    'site-links-internal': internalLinks,
    'site-links-external': externalLinks,
    'site-size': sizeLimits,
    'site-sitemap': sitemapMatches,
    'site-dead-assets': deadAssets,
    'site-svg': svgCompressed,
    'site-webmanifest': webManifest,
    'site-security-headers': securityHeaders,
};
