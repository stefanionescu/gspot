import { createRule } from '../rule.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

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
    if (body.loc.start.column === next.loc.start.column && isIndented) return true;
    return body.loc.start.line === owner.loc.end.line && next.loc.start.column > owner.loc.start.column;
}

export const noUnenclosedMultilineBlock = createRule<[], 'unenclosed'>({
    name: 'no-unenclosed-multiline-block',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a statement after an if, for, or while whose body has no braces, when its layout makes it look like part of that body: it sits on the same line as the body, at the same indent as an indented body, or indented under a body that shares the line of its condition.',
            why: 'Without braces, only the first statement belongs to the body, so the next statement runs every time even though it looks conditional.',
            fix: 'Add braces around every statement that belongs to the body, or move the next statement to its own line at the outer indent.',
            example: '`if (isReady)\\n    start();\\n    notify();` reports `unenclosed` at `notify();`.',
        },
        schema: [],
        messages: {
            unenclosed:
                'This statement runs {{runs}}, but its layout puts it in the body above. Add braces or move it out.',
        },
    },
    create(context) {
        const inspect = (statements: readonly TSESTree.ProgramStatement[]) => {
            for (const [index, owner] of statements.entries()) {
                const next = statements[index + 1];
                const body = getLastBody(owner);
                if (next === undefined || body === undefined || body.type === AST_NODE_TYPES.BlockStatement) continue;
                if (!isMisleading(owner, body, next)) continue;
                const runs = owner.type === AST_NODE_TYPES.IfStatement ? 'unconditionally' : 'only once';
                context.report({ node: next, messageId: 'unenclosed', data: { runs } });
            }
        };
        return {
            Program: (node) => {
                inspect(node.body);
            },
            BlockStatement: (node) => {
                inspect(node.body);
            },
            TSModuleBlock: (node) => {
                inspect(node.body);
            },
        };
    },
});
