import type { LintRuleDocs } from '#cli/types/tools.ts';
import { SYNTAX_RULE_DOCS } from '#cli/config/configurations/rule-docs/general.ts';
import { SITE_RULES, TRANSLATION_RULES, UNUSED_ASSET_RULE } from '#cli/config/configurations/framework.ts';

export const SITEMAP_RULE_DOCS = {
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
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const UNUSED_ASSET_RULE_DOCS = {
    [UNUSED_ASSET_RULE]: {
        description: 'No page, stylesheet, or script names a file under an assets folder.',
        why: 'The file ships with every deploy, and nobody can tell whether a page still needs it.',
        fix: 'Delete the file, or name it in the page, stylesheet, or script that loads it.',
        example: '`src/assets/old-logo.png`, which no page or stylesheet names, reports `unused-asset`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const TRANSLATION_RULE_DOCS = {
    [TRANSLATION_RULES.message]: {
        description: 'Each message parses as an ICU message.',
        why: 'A broken message shows raw text or throws when the app formats it.',
        fix: 'Fix the message syntax, such as an unclosed brace.',
        example: '`"greeting": "Hello {name"` reports `message`.',
    },
    [TRANSLATION_RULES.missingKey]: {
        description: 'Each locale has a message for each key of the base locale.',
        why: 'A missing message shows another language or the bare key to the users of that locale.',
        fix: 'Translate the message into this locale.',
        example: 'A `checkout.title` key in `en.json` and not in `de.json` reports `missing-key`.',
    },
    [TRANSLATION_RULES.extraKey]: {
        description: 'Each key of a locale exists in the base locale.',
        why: 'A key outside the base locale has no source text, and no code asks for it.',
        fix: 'Remove the key from this locale, or add the source text to the base locale.',
        example: 'A `checkout.old_title` key in `de.json` and not in `en.json` reports `extra-key`.',
    },
    [TRANSLATION_RULES.messageArguments]: {
        description: 'A translated message uses the arguments and choice forms of its base message.',
        why: 'A missing or renamed argument drops a value from the text, or fails when the app formats it.',
        fix: 'Use the argument names and choice forms of the base message.',
        example:
            '`{count, plural, ...}` in `en.json` and `{total, plural, ...}` in `de.json` report `message-arguments`.',
    },
    [TRANSLATION_RULES.baseLocale]: {
        description: 'The file of the base locale, such as `en.json`, exists beside the other locale files.',
        why: 'The check compares the keys and arguments of every locale with the base locale.',
        fix: 'Restore the base locale file, or set `translations.base_locale` to the locale that the project writes first.',
        example: 'A `messages/` folder with `de.json` and no `en.json` reports `base-locale`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;
