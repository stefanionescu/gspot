import { test, expect } from 'bun:test';
import { assertWritablePath } from '#cli/system/files/names.ts';
import { PORTABLE_PATHS } from '#tests/data/system/files/names.ts';

test.each([...PORTABLE_PATHS])('portable paths refuse $path: $refused', ({ path, refused }) => {
    if (refused)
        expect(() => {
            assertWritablePath(path);
        }).toThrow('is not a safe repository-relative path');
    else
        expect(() => {
            assertWritablePath(path);
        }).not.toThrow();
});
