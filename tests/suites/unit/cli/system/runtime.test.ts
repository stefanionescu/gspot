import { expect, test } from 'bun:test';

import { MINIMUM_NODE_VERSION, validateRuntimeVersion } from '#cli/system/runtime.ts';

test('gspot refuses a Node.js older than the minimum version in engines and names both versions', () => {
    expect(validateRuntimeVersion({ node: MINIMUM_NODE_VERSION })).toBeUndefined();
    const message = validateRuntimeVersion({ node: '0.0.0' });
    expect(message).toContain(MINIMUM_NODE_VERSION);
    expect(message).toContain('0.0.0');
});
