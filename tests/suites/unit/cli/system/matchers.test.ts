import { expect, test } from 'bun:test';

import { buildFilenameMatcher, buildPathMatcher } from '#cli/system/matchers.ts';

test('a path selector crosses folders with ** and negates with !', () => {
    const isSelected = buildPathMatcher(['scripts/**', '!scripts/vendor/**']);
    expect(isSelected('scripts/a/b.sh')).toBe(true);
    expect(isSelected('scripts/vendor/x.sh')).toBe(false);
    expect(isSelected('scripts/line\nbreak.sh')).toBe(true);
    expect(isSelected('scripts/vendor/line\nbreak.sh')).toBe(false);
});

test('a path selector reads a leading !( as an extglob, not as an exclusion', () => {
    const isSelected = buildPathMatcher(['!(generated)/**']);
    expect(isSelected('source/a.ts')).toBe(true);
    expect(isSelected('generated/a.ts')).toBe(false);
});

test('a filename glob that names a folder matches the whole path', () => {
    const isNamed = buildFilenameMatcher(['deno.json', '**/supabase/config.toml']);
    expect(isNamed('supabase/config.toml')).toBe(true);
    expect(isNamed('app/supabase/config.toml')).toBe(true);
    expect(isNamed('config.toml')).toBe(false);
    expect(isNamed('supabase/other.toml')).toBe(false);
});
