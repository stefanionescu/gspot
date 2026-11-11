import { expect, test } from 'bun:test';

import { MINIMUM_NODE_VERSION, validateRuntimeVersion } from '#cli/system/runtime.ts';

test('gspot refuses a Node.js older than the minimum version in engines and names that version', () => {
    expect(validateRuntimeVersion({ node: MINIMUM_NODE_VERSION })).toBeUndefined();
    expect(validateRuntimeVersion({ node: '0.0.0' })).toBe(
        `gspot needs Node.js ${MINIMUM_NODE_VERSION} or newer (found 0.0.0). If your terminal has a newer Node.js, this Git client gives hooks another PATH. Start it from a terminal, or add that folder to its PATH.`,
    );
});
