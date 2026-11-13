import { expect, test } from 'bun:test';

import { hasGeneratedHeader } from '#cli/repository/files/ownership.ts';
import { GENERATED_HEADERS, NOT_GENERATED } from '#tests/config/repository.ts';

test.each([...GENERATED_HEADERS])('the generated header is found in each comment form: %j', (text) => {
    expect(hasGeneratedHeader(text)).toBe(true);
});

test.each([...NOT_GENERATED])('your own comment is not a generated header: %j', (text) => {
    expect(hasGeneratedHeader(text)).toBe(false);
});
