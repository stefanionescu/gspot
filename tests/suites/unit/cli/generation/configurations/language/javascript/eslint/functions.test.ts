import { join } from 'node:path';
import { test, expect } from 'bun:test';

import {
    root,
    buildBlock,
    readPreset,
    addPlugins,
    setRuntime,
    mergePreset,
    spreadPreset,
    setLevelRules,
    setRootFolder,
    setJestGlobals,
    setImportLookup,
    setScriptParser,
    mergeRuleOptions,
    mergePresetRules,
    setBoundaryLookup,
    setComponentParser,
} from '#cli-configurations/language/javascript/config-files/eslint-functions.ts';

test('preset calls retain explicit values and merge rules without changing their inputs', () => {
    const block = { rules: { first: 'off' }, settings: { owned: true } };
    const preset = {
        configs: { selected: { languageOptions: { sourceType: 'module' }, rules: { first: 'error', second: 'warn' } } },
    };
    expect(buildBlock(block)).toStrictEqual(block);
    expect(buildBlock(block)).not.toBe(block);
    expect(readPreset(preset, 'configs.selected.rules')).toStrictEqual({ first: 'error', second: 'warn' });
    expect(mergePreset(block, preset, 'configs.selected')).toStrictEqual({
        ...block,
        languageOptions: { sourceType: 'module' },
        rules: { first: 'off', second: 'warn' },
    });
    expect(mergePresetRules(block, preset, 'configs.selected')).toStrictEqual({
        ...block,
        rules: { first: 'off', second: 'warn' },
    });
    expect(block.rules).toStrictEqual({ first: 'off' });
});

test('level calls retain disabled rules and apply the selected severity to enabled gspot rules', () => {
    const block = {
        rules: { 'gspot/enabled': ['error', { max: 2 }], 'gspot/missing': 'error', 'gspot/off': 0, other: 'error' },
    };
    const result = setLevelRules(
        block,
        { configs: { selected: { rules: { 'gspot/enabled': 'warn', 'gspot/off': 'error' } } } },
        'selected',
    );
    expect(result.rules).toStrictEqual({
        'gspot/enabled': ['warn', { max: 2 }],
        'gspot/missing': 'off',
        'gspot/off': 0,
        other: 'error',
    });
    expect(block.rules['gspot/missing']).toBe('error');
});

test('root and resolver calls retain settings and use absolute project paths', () => {
    const block = { settings: { existing: true } };
    expect(setRootFolder(block, [['settings', 'next', 'rootDir']], 'app').settings).toStrictEqual({
        existing: true,
        next: { rootDir: join(root, 'app') },
    });
    expect(setImportLookup(block, (options) => options, ['tsconfig.json']).settings).toStrictEqual({
        existing: true,
        'import-x/resolver-next': [{ project: [join(root, 'tsconfig.json')] }],
    });
    expect(setBoundaryLookup(block, ['app/tsconfig.json']).settings).toStrictEqual({
        existing: true,
        'import/resolver': { typescript: { project: [join(root, 'app/tsconfig.json')] } },
    });
    expect(block.settings).toStrictEqual({ existing: true });
});

test('plugin and parser calls preserve the other language settings', () => {
    const block = { languageOptions: { parserOptions: { sourceType: 'module' } }, plugins: { previous: {} } };
    const parser = { parse: true };
    const typescript = { typed: true };
    expect(addPlugins(block, { added: parser }).plugins).toStrictEqual({ previous: {}, added: parser });
    expect(setComponentParser(block, parser, typescript).languageOptions).toStrictEqual({
        parser,
        parserOptions: { sourceType: 'module', parser: { ts: typescript, typescript } },
    });
    expect(setComponentParser(block, parser).languageOptions).toStrictEqual({
        parser,
        parserOptions: { sourceType: 'module' },
    });
    expect(setScriptParser(block, typescript).languageOptions).toStrictEqual({
        parserOptions: { sourceType: 'module', parser: typescript },
    });
    expect(setRuntime(block, { node: { process: false } }, 'node', 'commonjs').languageOptions).toStrictEqual({
        parserOptions: { sourceType: 'module' },
        sourceType: 'commonjs',
        globals: { process: false },
    });
    expect(
        setJestGlobals(block, { environments: { globals: { globals: { test: false } } } }).languageOptions,
    ).toStrictEqual({ parserOptions: { sourceType: 'module' }, globals: { test: false } });
});

test('preset lists keep their files inside the scope, and rule options keep the severity of the preset', () => {
    const preset = {
        configs: {
            list: [
                { plugins: {}, languageOptions: { globals: { window: false, defineProps: false } } },
                { files: ['**/*.vue'], rules: { first: ['warn', { kept: true }] } },
            ],
        },
    };
    expect(
        spreadPreset({ files: [['**/*.js', 'app/**/*']], ignores: ['app/child/**'] }, preset, 'configs.list', {
            files: 'app/**/*',
            globals: { browser: { window: false } },
        }),
    ).toStrictEqual([
        {
            plugins: {},
            languageOptions: { globals: { defineProps: false } },
            files: [['**/*.js', 'app/**/*']],
            ignores: ['app/child/**'],
        },
        { files: [['**/*.vue', 'app/**/*']], rules: { first: ['warn', { kept: true }] }, ignores: ['app/child/**'] },
    ]);
    expect(mergePresetRules({ rules: { second: 'off' } }, preset, 'configs.list').rules).toStrictEqual({
        first: ['warn', { kept: true }],
        second: 'off',
    });
    expect(
        mergeRuleOptions(
            { rules: { first: ['warn', { kept: true }], plain: 'error' } },
            {
                first: { added: 1 },
                plain: { added: 1 },
            },
        ).rules,
    ).toStrictEqual({ first: ['warn', { kept: true, added: 1 }], plain: 'error' });
});

test('a runtime that the globals package does not name stops the config', () => {
    expect(() => setRuntime({}, { node: {}, browser: {} }, 'nodejs', 'module')).toThrow(
        'The globals package has no runtime named nodejs. Set tools.eslint.override.runtime to one of: node, browser.',
    );
});
