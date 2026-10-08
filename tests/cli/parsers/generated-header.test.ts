import { test, expect } from 'bun:test';
import { hasHeader } from '#cli/parsers/public.ts';
import { AUTHORED_HEADERS, GENERATED_HEADERS } from '#tests/config/cli/parsers/generated-header.ts';

test('generated markers recognize comment formats, CRLF, opening lines, and the first JSON key', () => {
    for (const text of GENERATED_HEADERS) expect(hasHeader(text)).toBe(true);
    for (const text of AUTHORED_HEADERS) expect(hasHeader(text)).toBe(false);
});
