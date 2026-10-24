import { test, expect } from 'bun:test';
import { assertWritablePath } from '#cli/system/files/names.ts';
import { REFUSED_PORTABLE_PATHS } from '#tests/config/system/files/names.ts';

test.each([...REFUSED_PORTABLE_PATHS])('portable paths refuse %p', (path) => {
    expect(() => {
        assertWritablePath(path);
    }).toThrow('is not a safe repository-relative path');
});
test('portable paths accept a relative document with Unicode, spaces and percent signs', () => {
    expect(() => {
        assertWritablePath('documents/équipe 50%.md');
    }).not.toThrow();
});
