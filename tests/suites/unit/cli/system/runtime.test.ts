import { expect, test } from 'bun:test';

import { validateRuntimeVersion } from '#cli/system/runtime.ts';

test('gspot refuses a Node.js older than the minimum version in engines and names that version', () => {
    const engines = { node: '>=24.0.0' };
    expect(validateRuntimeVersion({ node: '24.0.0' }, engines)).toBeUndefined();
    expect(validateRuntimeVersion({ node: '22.12.0' }, engines)).toBe(
        'gspot needs Node.js 24.0.0 or newer (found 22.12.0).',
    );
});
