import type { CanonicalAttribute } from '../types/route-metadata.ts';

/** Canonical URL attributes emitted by the documentation layout. */
export const CANONICAL_ATTRIBUTES: Record<string, CanonicalAttribute> = {
    link: { selector: 'rel', value: 'canonical', target: 'href' },
    meta: { selector: 'property', value: 'og:url', target: 'content' },
};
