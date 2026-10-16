import { test, expect } from 'bun:test';
import { buildPathMatcher } from '#cli/repository/matchers.ts';

test('path selectors: ** crosses folders and ! negates', () => {
    const matcher = buildPathMatcher(['scripts/**', '!scripts/vendor/**']);
    expect(matcher('scripts/a/b.sh')).toBe(true);
    expect(matcher('scripts/vendor/x.sh')).toBe(false);
    expect(matcher('scripts/line\nbreak.sh')).toBe(true);
    expect(matcher('scripts/vendor/line\nbreak.sh')).toBe(false);
});
