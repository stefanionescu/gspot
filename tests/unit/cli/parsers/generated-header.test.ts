import { test, expect } from 'bun:test';
import { hasGeneratedHeader } from '#cli/repository/classify.ts';
import { NOT_GENERATED, GENERATED_HEADERS } from '#tests/config/generated-files.ts';

test('the generated header is found in every comment form, after a shebang, and with CRLF', () => {
    for (const text of GENERATED_HEADERS) expect(hasGeneratedHeader(text)).toBe(true);
    for (const text of NOT_GENERATED) expect(hasGeneratedHeader(text)).toBe(false);
});
