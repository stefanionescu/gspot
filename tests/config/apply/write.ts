import { BLOCK_FORMATS } from '#tests/config/parsers/formats/managed-blocks.ts';

export const NON_UTF8_BLOCK_CASES = [...BLOCK_FORMATS, { path: '.gitattributes', style: 'hash' as const }] as const;

export const INVALID_PACKAGE_JSON_TEXTS = [
    { source: '', message: 'package.json:1:1 is not valid JSON: ValueExpected. Fix the file.' },
    { source: '[]', message: 'package.json must contain a JSON object. Fix the file.' },
    { source: 'false', message: 'package.json must contain a JSON object. Fix the file.' },
    { source: '{"stylelint":', message: 'package.json:1:14 is not valid JSON: ValueExpected. Fix the file.' },
] as const;
