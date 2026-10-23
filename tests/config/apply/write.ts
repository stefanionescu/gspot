import { BLOCK_FORMATS } from '#tests/config/parsers/formats/managed-blocks.ts';

export const NON_UTF8_BLOCK_CASES = [...BLOCK_FORMATS, { path: '.gitattributes', style: 'hash' as const }] as const;
