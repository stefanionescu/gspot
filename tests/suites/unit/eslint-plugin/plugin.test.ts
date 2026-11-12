import * as parser from '@typescript-eslint/parser';
import { Glob } from 'bun';
import { expect, test } from 'bun:test';
import { Linter } from 'eslint';

import plugin from '#eslint-plugin/plugin.ts';
import { LANGUAGE_TOPICS } from '#eslint-plugin/registry/language.ts';
import { LIBRARY_TOPICS } from '#eslint-plugin/registry/libraries.ts';

test('each rule file of a topic folder is registered under that topic and takes the name of its rule', () => {
    const registered = Object.entries({ ...LANGUAGE_TOPICS, ...LIBRARY_TOPICS }).flatMap(([topic, rules]) =>
        rules.map(({ name }) => `${topic}/${name}.ts`),
    );
    const folder = new URL('../../../../packages/eslint-plugin/src/rules/', import.meta.url).pathname;
    const files = [...new Glob('*/*.ts').scanSync(folder)];
    expect(registered.toSorted()).toStrictEqual(files.toSorted());
    const names = files.map((path) => path.slice(path.indexOf('/') + 1, -'.ts'.length));
    expect(Object.keys(plugin.rules).toSorted()).toStrictEqual(names.toSorted());
});

test('the recommended preset reports the rules of its level, and the all preset adds the others', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const source =
        "'use client';\nfunction readKey() {\n    return process.env.SECRET_KEY;\n}\nexport const key = readKey();\n";
    const options = { filename: '/repo/app/page.js' };
    const recommended: object[] = [plugin.configs.recommended];
    expect(linter.verify(source, recommended, options).map(({ ruleId }) => ruleId)).toStrictEqual([
        'gspot/no-client-environment',
    ]);
    const all: object[] = [plugin.configs.all];
    expect(linter.verify(source, all, options).map(({ ruleId }) => ruleId)).toStrictEqual([
        'gspot/no-trivial-functions',
        'gspot/no-client-environment',
    ]);
});

test('a config that registers the plugin again lowers a limit of configs.all', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [
        plugin.configs.all,
        {
            plugins: { gspot: plugin },
            rules: { 'gspot/no-trivial-functions': ['error', { trivialFunctionStatements: 1 }] },
        },
    ];
    const messages = linter.verify('function work() {\n    first();\n    second();\n}\nwork();\n', config);
    expect(messages).toStrictEqual([]);
});

test('a rule that needs type information reports nothing in a file without a TypeScript program', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const typedRules = Object.entries(plugin.rules).flatMap(([name, rule]) =>
        rule.meta.docs?.requiresTypeChecking === true ? [[`gspot/${name}`, 'error'] as const] : [],
    );
    const config: object = {
        files: ['**/*.tsx'],
        languageOptions: { parser },
        plugins: { gspot: plugin },
        rules: Object.fromEntries(typedRules),
    };
    const source = [
        "import { expect } from 'vitest';",
        "const names = ['a'];",
        "if ('a' in names) run();",
        "if (names.indexOf('a') > 0) run();",
        'names.map(String);',
        'function log(value: unknown) {}',
        '[1, 2].map(log);',
        "function read(raw: string) { if (raw) return '1'; return 1; }",
        'function save(draft: boolean) { if (draft) store(); else publish(); }',
        'read(undefined);',
        'class Store { constructor() { load(); } }',
        'try { list.sort(); } catch {}',
        "'title'.match('v1.2');",
        'type Options = { size: number } & {};',
        'function Badge(props: { label: string }) { return <b>{props.label}</b>; }',
        "const script = document.createElement('script');",
        "script.src = 'https://cdn.example.com/lib@1.2.3/lib.js';",
        "window.postMessage({ ready: true }, '*');",
        'expect(names.length).toBe(1);',
        'export const view = <div>{names.length && <b />}</div>;',
    ].join('\n');
    expect(linter.verify(source, config, { filename: '/repo/src/view.tsx' })).toStrictEqual([]);
});
