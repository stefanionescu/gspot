import { posix } from 'node:path';
import { readdirSync } from 'node:fs';
import { CODE_EXTENSION } from '#plugin/config/files.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { lintedPath, isAnyGlobMatch } from '#plugin/files.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { HelpersBesideTestsOptions } from '#plugin/types/rules.ts';
import { TEST_PATTERN, TEST_DIRECTORIES, ASSERTION_MODULES } from '#plugin/config/rules.ts';

function hasAssertions(
    context: Readonly<TSESLint.RuleContext<'misplaced', HelpersBesideTestsOptions>>,
    node: TSESTree.Program,
): boolean {
    const specifiers = node.body.flatMap((statement) =>
        statement.type === AST_NODE_TYPES.ImportDeclaration && ASSERTION_MODULES.has(statement.source.value)
            ? statement.specifiers
            : [],
    );
    return specifiers
        .filter(
            (specifier) =>
                specifier.type === AST_NODE_TYPES.ImportSpecifier &&
                specifier.imported.type === AST_NODE_TYPES.Identifier &&
                specifier.imported.name === 'expect',
        )
        .some((specifier) =>
            context.sourceCode.getDeclaredVariables(specifier).some((variable) =>
                variable.references.some(({ identifier }) => {
                    const call = identifier.parent;
                    return (
                        call.type === AST_NODE_TYPES.CallExpression &&
                        call.callee.type === AST_NODE_TYPES.Identifier &&
                        call.callee.name === specifier.local.name &&
                        call.parent.type === AST_NODE_TYPES.MemberExpression
                    );
                }),
            ),
        );
}

export const noHelpersBesideTests = createRule<HelpersBesideTestsOptions, 'misplaced'>({
    name: 'no-helpers-beside-tests',
    meta: {
        defaultOptions: [{}],
        type: 'suggestion',
        docs: {
            level: 'all',
            title: 'Tests directory contents',
            example:
                'With `harness: "tests/support"`, when `tests/unit/` contains `a.test.ts`, a neighboring non-test file `builders.ts` reports `misplaced`. Move `builders.ts` into `tests/support/` and update its imports. Declaration files such as `b.d.ts` can remain beside tests.',
            description:
                'Finds support code beside test files. Modules that call an imported framework assertion can stay with tests. With no harness directory, it reports nothing.',
            why: 'Shared setup belongs in the declared harness directory. Assertions belong with tests.',
            fix: 'Move the file into the configured test support directory.',
        },
        schema: [optionsSchema({ harness: { type: 'string' } })],
        messages: { misplaced: '{{name}} is not a test but sits beside tests. Move it to {{harness}}.' },
    },
    create(context, [configured]) {
        const file = lintedPath(context);
        if (file === undefined) return {};
        const { relative } = file;
        const { harness } = configured;
        const test = new RegExp(TEST_PATTERN, 'u');
        const name = posix.basename(relative);
        if (test.test(name) || name.endsWith('.d.ts') || !CODE_EXTENSION.test(name)) return {};
        if (harness === undefined) return {};
        return {
            Program(node) {
                if (relative.startsWith(`${harness}/`)) return;
                if (!isAnyGlobMatch(relative, TEST_DIRECTORIES)) return;
                if (hasAssertions(context, node)) return;
                if (
                    !readdirSync(posix.dirname(file.absolute), { withFileTypes: true }).some(
                        (entry) => entry.isFile() && test.test(entry.name),
                    )
                )
                    return;
                context.report({
                    node,
                    messageId: 'misplaced',
                    data: { name, harness },
                });
            },
        };
    },
});
