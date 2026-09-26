import { expect, test } from 'bun:test';
import { configurationDocument } from '#cli/lifecycle/configuration-document.ts';

test('YAML field reads preserve nested mappings, sequences, scalars, aliases, and missing keys', () => {
    const document = configurationDocument(
        'defaults: &shared\n  enabled: false\n  values: [0, null, ""]\nfirst: *shared\n',
        'yaml',
    );
    expect(document.value(['defaults', 'enabled'])).toBe(false);
    expect(document.value(['first', 'enabled'])).toBe(false);
    expect(document.value(['first', 'values', 0])).toBe(0);
    expect(document.value(['defaults', 'values', 1])).toBeNull();
    expect(document.value(['defaults', 'values', 2])).toBe('');
    expect(document.value(['first'])).toStrictEqual({ enabled: false, values: [0, null, ''] });
    expect(document.value(['missing', 'enabled'])).toBeUndefined();
    expect(document.value(['defaults', 'enabled', 'missing'])).toBeUndefined();
    document.set(['defaults', 'enabled'], true);
    expect(document.value(['first', 'enabled'])).toBe(true);
});
