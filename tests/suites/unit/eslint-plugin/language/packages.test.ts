import { Linter } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import type { FileContext } from '#eslint-plugin/types/plugin.ts';
import { readPackageFacts } from '#eslint-plugin/language/packages.ts';
import { writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

test('a package.json that is not valid JSON, or that holds null, lists no dependencies', () => {
    const root = writePackageFolders({ template: {} });
    writeFileSync(join(root, 'template/package.json'), '{ "name": <%= name %> }');
    writeFileSync(join(root, 'package.json'), 'null');
    const facts: Array<ReturnType<typeof readPackageFacts>> = [];
    const rule = {
        create: (context: FileContext) => {
            facts.push(readPackageFacts(context));
            return {};
        },
    };
    const config: object = {
        plugins: { probe: { rules: { facts: rule } } },
        rules: { 'probe/facts': 'error' },
        settings: { gspot: { root } },
    };
    new Linter({ configType: 'flat', cwd: root }).verify('', config, { filename: join(root, 'template/cart.js') });
    expect(facts).toStrictEqual([{ dependencies: new Map(), manifests: 2 }]);
});
