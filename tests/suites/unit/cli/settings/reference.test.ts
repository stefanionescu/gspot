import { test, expect } from 'bun:test';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildSettingsReference } from '#cli/settings/reference.ts';

const settings = buildSettingsReference(readConfigurations().values().toArray());

test('settings reference keeps reasoned values as leaves and names language and category inheritance', () => {
    const limits = settings.find(({ key }) => key === 'limits');
    const naming = settings.find(({ key }) => key === 'naming');
    expect(limits?.children.find(({ name }) => name === 'max_file_lines')).toMatchObject({
        kind: 'value',
        reasoned: true,
        children: [],
    });
    expect(limits?.children.find(({ name }) => name === 'javascript')?.variantOf).toBe('limits');
    const javascript = naming?.children.find(({ name }) => name === 'javascript');
    expect(javascript?.variantOf).toBe('naming');
    expect(javascript?.children.find(({ name }) => name === 'functions')?.variantOf).toBe('naming.<language>');
});

test('settings reference distinguishes root-only tables and scope keys from nested required fields', () => {
    expect(settings.find(({ key }) => key === 'ci')?.rootOnly).toBe(true);
    expect(settings.find(({ key }) => key === 'level')?.rootOnly).toBe(true);
    const format = settings.find(({ key }) => key === 'format');
    expect(format?.rootOnly).toBe(false);
    expect(format?.scopeKeys).toContain('indent_width');
    const record = settings.find(({ key }) => key === 'import_rule');
    expect(record?.kind).toBe('record');
    expect(record?.children.filter(({ required }) => required).map(({ name }) => name)).toEqual(['name', 'paths']);
});
