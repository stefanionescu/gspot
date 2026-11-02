import { createRule } from '../../rule.ts';
import { usesModule } from '../../libraries/packages.ts';
import { getCalleeName } from '../../libraries/testing.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { VITEST_MOCK_RECEIVERS, VITEST_GLOBAL_ORIGINS, VITEST_IMPORT_ORIGINS } from '../../config/testing.ts';

export const noNestedVitestMock = createRule<[], 'scope'>({
    name: 'no-nested-vitest-mock',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a `vi.mock()` or `vitest.mock()` call that is not a statement of its own at the top of the module: inside a function, a block, or an expression. It reads `vi` and `vitest` imported from Vitest, or as globals in files that use Vitest.',
            why: 'Vitest moves every `vi.mock()` call to the top of the file before the imports run. A call inside a test or a condition still runs first and for every test, so it cannot mock for one test or at run time.',
            fix: 'Move the call to the top level of the module, or use `vi.doMock()` to mock at run time.',
            example:
                '`it("reads", () => { vi.mock("./store"); })` reports `scope`. Move `vi.mock("./store");` to the top of the file, or write `vi.doMock("./store")`.',
        },
        schema: [],
        messages: {
            scope: 'Move this call to module scope or replace it with vi.doMock(); vi.mock is hoisted and cannot provide runtime or per-test mocking.',
        },
    },
    create(context) {
        const origins = usesModule(context, ['vitest']) ? VITEST_GLOBAL_ORIGINS : VITEST_IMPORT_ORIGINS;
        return {
            'CallExpression[optional=false][callee.type="MemberExpression"][callee.optional=false][callee.object.type="Identifier"][callee.property.name="mock"]'(
                node: TSESTree.CallExpression & { callee: TSESTree.MemberExpression },
            ) {
                const callee = getCalleeName(node.callee, context.sourceCode);
                const isVitest =
                    callee !== undefined && VITEST_MOCK_RECEIVERS.has(callee.name) && origins.has(callee.module);
                const isTopLevel =
                    node.parent.type === AST_NODE_TYPES.ExpressionStatement &&
                    node.parent.parent.type === AST_NODE_TYPES.Program;
                if (isVitest && !isTopLevel) context.report({ node: node.callee, messageId: 'scope' });
            },
        };
    },
});
