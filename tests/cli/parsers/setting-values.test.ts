import { z } from 'zod';
import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { relativePath } from '#cli/policy/schema/fields.ts';
import { compileSettingValue } from '#cli/policy/schema/settings.ts';
import { settingSchemaSources } from '#cli/generation/setting-values.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { settingNamespaceSchemas } from '#cli/policy/schema/namespaces.ts';
import { settingValueSchemas } from '#cli/policy/schema/setting-values.ts';
import { activeSettingNamespaceSchemas } from '#cli/policy/schema/active-settings.ts';

test('a path declaration permits an empty disabling value only when its native default declares it', () => {
    const strict = compileSettingValue({ type: 'path', validation: {} });
    const disabled = compileSettingValue({ type: 'path', validation: {}, default: '' });
    expect(strict.schema).toBe(relativePath);
    expect(strict.schema.safeParse('').success).toBe(false);
    for (const source of ['', 'spec/openapi.yml', '../outside.yml', '/absolute.yml']) {
        expect(disabled.schema.safeParse(source).success).toBe(source === '' || source === 'spec/openapi.yml');
    }
    expect(z.toJSONSchema(disabled.schema)).toMatchObject({
        anyOf: [
            { type: 'string', const: '' },
            { type: 'string', minLength: 1 },
        ],
    });
});

test('compiled keys retain their item type at the actual runtime boundary', () => {
    const imports: string[] = settingValueSchemas['tools.swiftlint.keep_imports'].parse(['Foundation']);
    expect(imports).toStrictEqual(['Foundation']);
    expect(settingValueSchemas['tools.swiftlint.keep_imports'].safeParse([false]).success).toBe(false);
    const values = settingNamespaceSchemas['tools.swiftlint'].parse({ keep_imports: imports });
    const selectedImports: string[] | undefined = values.keep_imports;
    expect(selectedImports).toStrictEqual(['Foundation']);
    expect(settingNamespaceSchemas['tools.swiftlint'].safeParse({ misspelled: true }).success).toBe(false);
    expect(settingNamespaceSchemas['tools.swiftlint'].parse({})).toStrictEqual({});
});

test('compiled namespace records use native rule schemas and typed declaration fields', () => {
    const schema = settingNamespaceSchemas['tools.eslint'];
    expect(
        schema.parse({
            rules: { 'quote-props': ['as-needed'] },
            restricted_imports: [{ name: 'http', message: 'Use fetch.' }],
        }),
    ).toMatchObject({
        rules: { 'quote-props': ['as-needed'] },
        restricted_imports: [{ name: 'http', message: 'Use fetch.' }],
    });
    expect(schema.safeParse({ rules: { 'quote-props': ['error'] } }).success).toBe(false);
    expect(schema.safeParse({ restricted_imports: [{ name: 'http', message: false }] }).success).toBe(false);
    expect(
        schema.safeParse({ restricted_imports: [{ name: 'http', message: 'Use fetch.', typo: true }] }).success,
    ).toBe(false);
    expect(schema.parse({})).toStrictEqual({});
});

test('the compiler-owned schema equals a fresh declaration compilation', async () => {
    const declarations = [...configurationManifests().values()];
    const sources = settingSchemaSources(declarations);
    for (const [path, source] of sources) {
        const target = fileURLToPath(new URL('../../../packages/cli/' + path, import.meta.url));
        const formatting = await resolveConfig(target);
        const fresh = await format(source, { ...formatting, filepath: target });
        expect(await readFile(target, 'utf8')).toBe(fresh);
        expect(await format(settingSchemaSources(declarations).get(path)!, { ...formatting, filepath: target })).toBe(
            fresh,
        );
    }
});

test('effective namespaces require only defaults guaranteed by their real provider closures', () => {
    const coverage = activeSettingNamespaceSchemas.coverage;
    expect(coverage.safeParse({}).success).toBe(false);
    expect(coverage.parse({ lines: 0, branches: 0, functions: 0, statements: 0, overrides: [] })).toStrictEqual({
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
        overrides: [],
    });
    expect(settingNamespaceSchemas.coverage.parse({})).toStrictEqual({});
    expect(activeSettingNamespaceSchemas.architecture.parse({ modules: [] })).toStrictEqual({ modules: [] });
    expect(
        activeSettingNamespaceSchemas.architecture.safeParse({ modules: [], roles: { misspelled: [] } }).success,
    ).toBe(false);
    expect(
        activeSettingNamespaceSchemas['tools.eslint'].parse({
            rules: {},
            overrides: [],
            import_extensions: { '**/*': 'js' },
            runtimes: {},
            restricted_imports: [],
        }),
    ).not.toHaveProperty('node_version');
    expect(
        activeSettingNamespaceSchemas['tools.eslint'].safeParse({ import_extensions: { '**/*': false } }).success,
    ).toBe(false);
});
