import { SITE_RULES, UNUSED_ASSET_RULE } from '#cli/config/configurations/framework.ts';
import type { RuleExplanations } from '#cli/types/tools.ts';

export const SITEMAP_EXPLANATIONS = {
    [SITE_RULES.missingPage]: {
        description: 'Each URL of the sitemap has a page in the build.',
        why: 'A search engine that follows the URL gets a page that does not exist.',
        fix: 'Remove the URL from the sitemap, or build the page.',
        example: 'A sitemap entry `https://example.com/pricing/` with no `pricing/index.html` reports `missing-page`.',
    },
    [SITE_RULES.unlistedPage]: {
        description: 'The sitemap lists each page that the build writes, except `site.allowed_unlisted_pages`.',
        why: 'A search engine reads the sitemap to find pages, and misses the pages that it leaves out.',
        fix: 'Add the page to the sitemap, or list its path under `site.allowed_unlisted_pages`.',
        example: 'A built `about/index.html` that the sitemap does not list reports `unlisted-page`.',
    },
    [SITE_RULES.invalidUrl]: {
        description: 'Each `<loc>` of the sitemap holds an absolute URL with valid escapes.',
        why: 'A search engine skips a URL that it cannot parse.',
        fix: 'Write the full URL, such as `https://example.com/about/`, with its special characters escaped.',
        example: '`<loc>/about/</loc>` reports `invalid-url`.',
    },
} as const satisfies RuleExplanations;

export const UNUSED_ASSET_EXPLANATIONS = {
    [UNUSED_ASSET_RULE]: {
        description: 'No page, stylesheet, or script names a file under an assets folder.',
        why: 'The file ships with every deploy, and nobody can tell whether a page still needs it.',
        fix: 'Delete the file, or name it in the page, stylesheet, or script that loads it.',
        example: '`src/assets/old-logo.png`, which no page or stylesheet names, reports `unused-asset`.',
    },
} as const satisfies RuleExplanations;
