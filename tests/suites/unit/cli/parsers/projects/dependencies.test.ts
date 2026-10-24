import { test, expect } from 'bun:test';
import { PARSERS } from '#cli/parsers/projects/dependencies.ts';
import { SWIFT_DEPENDENCY_CALLS } from '#tests/config/parsers/projects/dependencies.ts';

test('Swift dependencies include package calls and exclude comments, strings, local paths, and binary targets', async () => {
    const parsed = await PARSERS['Package.swift']!('Package.swift', SWIFT_DEPENDENCY_CALLS);
    expect(parsed.dependencies).toStrictEqual({ live: 'https://example.com/live.git' });
    expect(parsed.installed).toStrictEqual(parsed.dependencies);
});
