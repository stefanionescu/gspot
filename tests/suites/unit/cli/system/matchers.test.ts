import { test, expect } from 'bun:test';
import { buildPathMatcher } from '#cli/system/matchers.ts';

test('a path selector crosses folders with ** and negates with !', () => {
    const isSelected = buildPathMatcher(['scripts/**', '!scripts/vendor/**']);
    expect(isSelected('scripts/a/b.sh')).toBe(true);
    expect(isSelected('scripts/vendor/x.sh')).toBe(false);
    expect(isSelected('scripts/line\nbreak.sh')).toBe(true);
    expect(isSelected('scripts/vendor/line\nbreak.sh')).toBe(false);
});
