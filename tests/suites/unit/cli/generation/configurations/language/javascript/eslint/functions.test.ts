import { test, expect } from 'bun:test';
import { setRuntime } from '#cli-configurations/language/javascript/config-files/eslint-functions.ts';

test('a runtime that the globals package does not name stops the config', () => {
    expect(() => setRuntime({}, { node: {}, browser: {} }, 'nodejs', 'module')).toThrow(
        'The globals package has no runtime named nodejs. Set tools.eslint.override.runtime to one of: node, browser.',
    );
});
