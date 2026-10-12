import { test, expect } from 'bun:test';
import { pathMatcher } from '#cli/repository/selectors.ts';

test('path selectors: ** crosses folders and ! negates', () => {
    const matcher = pathMatcher(['scripts/**', '!scripts/vendor/**']);
    expect(matcher('scripts/a/b.sh')).toBe(true);
    expect(matcher('scripts/vendor/x.sh')).toBe(false);
    expect(matcher('scripts/line\nbreak.sh')).toBe(true);
    expect(matcher('scripts/vendor/line\nbreak.sh')).toBe(false);
});
