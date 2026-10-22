/** Where a root-relative link points outside a site: the same path from the repository root, as GitHub reads it. */
export const LYCHEE_REPOSITORY_LINKS = 'file://$1/';

/**
 * The file links that lychee builds from root-relative links: docs/lychee passes the repository root plus
 * .gspot/root-links as its root folder.
 */
export const LYCHEE_ROOT_LINKS = String.raw`^file://(.*)/\.gspot/root-links/`;

/** An attribute of an .mdx page that holds an expression in braces holds code, which lychee reads as a file name. */
export const LYCHEE_MDX_EXPRESSION = '%7B[^/]*%7D';

export const LYCHEE_NOTES = [
    '# This file stops lychee from reading a lychee.toml in the folder where it runs.',
    '# Allow a URL with the docs.allowed_urls setting.',
    '# A link that starts with / starts at the repository root, as on GitHub; in a site, it names a route.',
];

export const SITE_CONFIGURATION = 'site';
