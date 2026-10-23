export const LYCHEE_REPOSITORY_LINKS = 'file://$1/';

export const LYCHEE_ROOT_LINKS = String.raw`^file://(.*)/\.gspot/root-links/`;

export const LYCHEE_MDX_EXPRESSION = '%7B[^/]*%7D';

export const LYCHEE_NOTES = [
    '# This file stops lychee from reading a lychee.toml in the folder where it runs.',
    '# Allow a URL with the docs.allowed_urls setting.',
    '# A link that starts with / starts at the repository root, as on GitHub; in a site, it names a route.',
];

export const SITE_CONFIGURATION = 'site';
