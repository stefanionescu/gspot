import { test, expect } from 'bun:test';
import cliPackage from '#cli-package' with { type: 'json' };
import { validateRuntimeVersion } from '#cli/system/runtime.ts';

test('gspot refuses a Node.js or Bun older than the engines minimum and names the minimum', () => {
    const engines = cliPackage.engines;
    expect(validateRuntimeVersion({ node: '24.15.0' }, engines)).toBeUndefined();
    expect(validateRuntimeVersion({ node: '22.12.0' }, engines)).toBe(
        'gspot needs Node.js 24.15.0 or newer (found 22.12.0).',
    );
    // Bun reports its own Node.js version, so only the Bun version decides.
    expect(validateRuntimeVersion({ node: '22.12.0', bun: '1.4.2' }, engines)).toBeUndefined();
    expect(validateRuntimeVersion({ node: '26.3.0', bun: '1.3.9' }, engines)).toBe(
        'gspot needs Bun 1.4.2 or newer (found 1.3.9).',
    );
});
