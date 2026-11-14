import { test, expect } from 'bun:test';
import { hasGeneratedHeader } from '#cli/repository/files/ownership.ts';
import { NOT_GENERATED, GENERATED_HEADERS } from '#tests/config/repository.ts';

test.each([...GENERATED_HEADERS])('the generated header is found in each comment form: %j', (text) => {
    expect(hasGeneratedHeader(text)).toBe(true);
});

test.each([...NOT_GENERATED])('your own comment is not a generated header: %j', (text) => {
    expect(hasGeneratedHeader(text)).toBe(false);
});
