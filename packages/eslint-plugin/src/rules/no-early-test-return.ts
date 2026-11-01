import { createRule } from '../rule.ts';
import { usesModule, readTestCall, listImportedModules } from '../testing.ts';
import type { TestCall, FileContext, EarlyReturnFramework } from '../types/rules.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    PLAYWRIGHT_MODULE,
    EARLY_RETURN_GUARD,
    EARLY_RETURN_IMPORTS,
    EARLY_RETURN_MODIFIERS,
    EARLY_RETURN_DEPENDENCIES,
} from '../config/testing.ts';

function selectFramework(context: FileContext): EarlyReturnFramework | undefined {
    const imported = listImportedModules(context.sourceCode);
    const direct = EARLY_RETURN_IMPORTS.find(({ modules }) => modules.some((module) => imported.has(module)));
    if (direct !== undefined) return direct.framework;
    return EARLY_RETURN_DEPENDENCIES.find(({ modules, dependencies }) => usesModule(context, modules, dependencies))
        ?.framework;
}

function readRunningTest(
    node: TSESTree.CallExpression,
    source: TSESLint.SourceCode,
    framework: EarlyReturnFramework,
): TestCall | undefined {
    const call = readTestCall(node, source);
    if (call?.kind !== 'test' || (framework === 'playwright' && call.module !== PLAYWRIGHT_MODULE)) return undefined;
    const isRunning = call.modifiers.every((modifier) => EARLY_RETURN_MODIFIERS[framework].has(modifier));
    return isRunning && call.callback === node.arguments.at(-1) ? call : undefined;
}

export const noEarlyTestReturn = createRule<[], EarlyReturnFramework>({
    name: 'no-early-test-return',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a test whose body starts with `if (condition) return;` and goes on with more statements. It reads the framework from the imports, then from package.json: Mocha, Vitest, Playwright, node:test, and Bun. Jest, Jasmine, AVA, and QUnit have no skip call inside a test, so their files are not checked.',
            why: 'A test that returns early passes without checking anything, and the report counts it as passed instead of skipped.',
            fix: "Skip the test through the framework, so the report shows it as skipped: `this.skip()` in Mocha, the context's `skip()` in Vitest and node:test, `test.skip(condition)` in Playwright, and `test.skipIf(condition)` in Bun.",
            example:
                '`it("pays", function () { if (!ready) return; pay(); })` reports `mocha`. Write `if (!ready) { this.skip(); }`.',
        },
        schema: [],
        messages: {
            mocha: 'Call `this.skip()` instead of returning early.',
            vitest: "Call the test context's `skip()` instead of returning early.",
            playwright: 'Call `test.skip(condition)` instead of returning early.',
            nodeTest: "Call the test context's `skip()` before returning early.",
            bun: 'Move the condition to `test.skipIf()` instead of returning early.',
        },
    },
    create(context) {
        const framework = selectFramework(context);
        if (framework === undefined) return {};
        return {
            [EARLY_RETURN_GUARD](guard: TSESTree.IfStatement) {
                const callback = guard.parent.parent;
                const call = callback?.parent;
                if (call?.type !== AST_NODE_TYPES.CallExpression) return;
                if (readRunningTest(call, context.sourceCode, framework)?.callback !== callback) return;
                const { consequent } = guard;
                const early = consequent.type === AST_NODE_TYPES.BlockStatement ? consequent.body[0] : consequent;
                context.report({ node: early ?? guard, messageId: framework });
            },
        };
    },
});
