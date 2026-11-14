import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import type { FileContext } from '#eslint-plugin/types/plugin.ts';
import { getQualifiedName } from '#eslint-plugin/language/modules.ts';

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
