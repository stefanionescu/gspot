import { expect, test } from 'bun:test';

import { DEPENDENCY_FILE_PARSERS } from '#cli/parsers/projects/dependencies.ts';
import { SWIFT_DEPENDENCY_CALLS } from '#tests/config/parsers/formats.ts';

test('Swift dependencies include package calls and exclude comments, strings, local paths, and binary targets', async () => {
    const parsed = await DEPENDENCY_FILE_PARSERS.get('Package.swift')!('Package.swift', SWIFT_DEPENDENCY_CALLS);
    expect(parsed.dependencies).toStrictEqual({ live: 'https://example.com/live.git' });
    expect(parsed.installed).toStrictEqual(parsed.dependencies);
});
