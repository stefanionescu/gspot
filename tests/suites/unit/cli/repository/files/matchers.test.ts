import { test, expect } from 'bun:test';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';

test('a path selector crosses folders with ** and negates with !', () => {
    const isMatcher = buildPathMatcher(['scripts/**', '!scripts/vendor/**']);
    expect(isMatcher('scripts/a/b.sh')).toBe(true);
    expect(isMatcher('scripts/vendor/x.sh')).toBe(false);
    expect(isMatcher('scripts/line\nbreak.sh')).toBe(true);
    expect(isMatcher('scripts/vendor/line\nbreak.sh')).toBe(false);
});
