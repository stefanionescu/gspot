import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../../rule.ts';

function getLastBody(statement: TSESTree.ProgramStatement): TSESTree.Statement | undefined {
    switch (statement.type) {
        case AST_NODE_TYPES.IfStatement: {
            return statement.alternate ?? statement.consequent;
        }
        case AST_NODE_TYPES.ForStatement:
        case AST_NODE_TYPES.ForInStatement:
        case AST_NODE_TYPES.ForOfStatement:
        case AST_NODE_TYPES.WhileStatement: {
            return statement.body;
        }
        default: {
            return undefined;
        }
    }
}

function isMisleading(owner: TSESTree.Node, body: TSESTree.Node, next: TSESTree.Node): boolean {
    if (body.loc.end.line === next.loc.start.line) return true;
    const isIndented = body.loc.start.column > owner.loc.start.column;
    return (
        (body.loc.start.column === next.loc.start.column && isIndented) ||
        (body.loc.start.line === owner.loc.end.line && next.loc.start.column > owner.loc.start.column)
    );
}

function listUnenclosedStatements(
    statements: readonly TSESTree.ProgramStatement[],
): Array<TSESLint.ReportDescriptor<'unenclosed'>> {
    return statements.flatMap((owner, index): Array<TSESLint.ReportDescriptor<'unenclosed'>> => {
        const next = statements[index + 1];
        const body = getLastBody(owner);
        if (
            next === undefined ||
            body === undefined ||
            body.type === AST_NODE_TYPES.BlockStatement ||
            !isMisleading(owner, body, next)
        )
            return [];
        const runs = owner.type === AST_NODE_TYPES.IfStatement ? 'unconditionally' : 'only once';
        return [{ node: next, messageId: 'unenclosed', data: { runs } }];
    });
}

export const noUnenclosedMultilineBlock = createRule<[], 'unenclosed'>({
    name: 'no-unenclosed-multiline-block',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a statement after an `if`, `for`, or `while` without braces whose layout makes it look like part of that body.',
            why: 'Without braces, only the first statement belongs to the body, so the next statement runs every time even though it looks conditional.',
            fix: 'Add braces around every statement that belongs to the body, or move the next statement to its own line at the outer indent.',
            example:
                '`if (isReady) start();` followed by an indented `notify();` on the next line reports `unenclosed` at `notify();`.',
        },
        schema: [],
        messages: {
            unenclosed:
                'This statement runs {{runs}}, but its layout puts it in the body above. Add braces or move it out.',
        },
    },
    create(context) {
        return {
            Program: (node) => {
                for (const issue of listUnenclosedStatements(node.body)) context.report(issue);
            },
            BlockStatement: (node) => {
                for (const issue of listUnenclosedStatements(node.body)) context.report(issue);
            },
            TSModuleBlock: (node) => {
                for (const issue of listUnenclosedStatements(node.body)) context.report(issue);
            },
        };
    },
});
