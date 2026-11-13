import { expect, test } from 'bun:test';
import { Linter } from 'eslint';

import { findPathInRoot, getQualifiedName } from '#eslint-plugin/language/modules.ts';
import type { FileContext } from '#eslint-plugin/types/plugin.ts';

test('a call through two variables that hold each other names no module', () => {
    const names: Array<string | undefined> = [];
    const rule = {
        create: (context: FileContext) => ({
            'CallExpression > Identifier.callee': (callee: Parameters<typeof getQualifiedName>[0]) => {
                names.push(getQualifiedName(callee, context.sourceCode));
            },
        }),
    };
    const config: object = { plugins: { probe: { rules: { name: rule } } }, rules: { 'probe/name': 'error' } };
    new Linter({ configType: 'flat' }).verify('let first = second; let second = first; first();', config);
    expect(names).toStrictEqual([undefined]);
});

test('a root setting that is not a string counts as unset', () => {
    const path = findPathInRoot({
        cwd: '/repo',
        physicalFilename: '/repo/src/cart.ts',
        settings: { gspot: { root: 1 } },
    });
    expect(path).toBe('src/cart.ts');
});
