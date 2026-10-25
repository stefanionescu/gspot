import { test, expect } from 'bun:test';
import { isPortablePath } from '#cli/system/files/names.ts';
import { REFUSED_PORTABLE_PATHS } from '#tests/config/system/files/names.ts';

test.each([...REFUSED_PORTABLE_PATHS])('portable paths refuse %p', (path) => {
    expect(isPortablePath(path)).toBe(false);
});
test('portable paths accept a relative document with Unicode, spaces and percent signs', () => {
    expect(isPortablePath('documents/équipe 50%.md')).toBe(true);
});
