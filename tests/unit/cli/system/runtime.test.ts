import { test, expect } from 'bun:test';
import { findRuntimeError } from '#cli/system/runtime.ts';
import packageManifest from '#cli-package' with { type: 'json' };

test('gspot refuses a Node.js or Bun older than the engines floor and names the floor', () => {
    const engines = packageManifest.engines;
    expect(findRuntimeError({ node: '24.15.0' }, engines)).toBeUndefined();
    expect(findRuntimeError({ node: '22.12.0' }, engines)).toBe(
        'gspot needs Node.js 24.15.0 or newer (found 22.12.0).',
    );
    // Bun reports its own Node.js version, so only the Bun version decides.
    expect(findRuntimeError({ node: '22.12.0', bun: '1.4.2' }, engines)).toBeUndefined();
    expect(findRuntimeError({ node: '26.3.0', bun: '1.3.9' }, engines)).toBe(
        'gspot needs Bun 1.4.2 or newer (found 1.3.9).',
    );
});
