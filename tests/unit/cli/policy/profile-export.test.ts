// An exported profile keeps the ESLint rules of the policy and leaves out what only fits this repository.
import { test, expect } from 'bun:test';
import { parseProfile } from '#cli/policy/profiles/parse.ts';
import { exportedProfile } from '#cli/policy/profiles/export.ts';
import { ESLINT_OVERRIDE_POLICY } from '#tests/samples/javascript.ts';

test('profile export preserves ESLint rules and omits repository-specific overrides', () => {
    const exported = exportedProfile(ESLINT_OVERRIDE_POLICY, 'project.profile.toml');
    expect(exported.text).not.toContain('overrides');
    expect(parseProfile(exported.text, 'project.profile.toml').tables.tools?.eslint?.rules?.['eqeqeq']).toStrictEqual([
        'error',
        'smart',
    ]);
    expect(exported.leftOut).toContain('tools.eslint.overrides[0]: names a repository path');
});
