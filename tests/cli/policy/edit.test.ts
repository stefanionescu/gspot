import { test, expect } from 'bun:test';
import { setKey, proposePolicy } from '#cli/policy/edit.ts';
import type { Mutation } from '#cli/types/policy/settings.ts';

test('policy edits keep a trailing array comma and write inline tables without one', () => {
    const original = '# Authored selection.\nconfigurations = ["security",]\n';
    const entry = {
        rule: 'js/file-system-race',
        paths: ['fixture.js'],
        reason: 'A deliberate fixture owns its temporary files.',
    };
    const mutate: Mutation = (raw) => {
        setKey(raw, 'tools.codeql.ignore', [entry]);
    };
    const proposed = proposePolicy('.', original, mutate);
    expect(proposed.text).toContain('# Authored selection.');
    expect(proposed.text).not.toMatch(/,\s*\}/u);
    expect(proposed.policy.tools['codeql']?.['ignore']).toStrictEqual([entry]);
    const repeated = proposePolicy('.', proposed.text, mutate);
    expect(repeated.changed).toBe(false);
    expect(repeated.text).toBe(proposed.text);
});
