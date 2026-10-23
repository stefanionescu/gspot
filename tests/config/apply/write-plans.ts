import { BLOCK_FORMATS } from '#tests/config/parsers/formats/managed-blocks.ts';

/** Managed block files whose bytes do not decode as UTF-8. */
export const NON_UTF8_BLOCK_CASES = [...BLOCK_FORMATS, { path: '.gitattributes', style: 'hash' as const }] as const;
