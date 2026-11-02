import { createRule } from '../rule.ts';
import { getQualifiedName } from '../modules.ts';
import { getExpressionValue } from '../expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    OCTAL_RADIX,
    OTHERS_MASK,
    CHMOD_METHODS,
    UMASK_FUNCTION,
    FILE_MODE_MODULE,
    FILE_MODE_CONSTANTS,
} from '../config/security.ts';

function getLiteralMode(literal: TSESTree.Literal): number | undefined {
    if (typeof literal.value === 'string') return Number.parseInt(literal.value, OCTAL_RADIX);
    return typeof literal.value === 'number' ? literal.value : undefined;
}

function getConstantMode(source: Readonly<TSESLint.SourceCode>, member: TSESTree.MemberExpression): number | undefined {
    const isConstants = getQualifiedName(member.object, source) === FILE_MODE_MODULE;
    const name = ASTUtils.getPropertyName(member) ?? '';
    return isConstants && Object.hasOwn(FILE_MODE_CONSTANTS, name) ? FILE_MODE_CONSTANTS[name] : undefined;
}

function getMode(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): number | undefined {
    const value = getExpressionValue(node, source);
    switch (value?.type) {
        case AST_NODE_TYPES.Literal: {
            return getLiteralMode(value);
        }
        case AST_NODE_TYPES.MemberExpression: {
            return getConstantMode(source, value);
        }
        case AST_NODE_TYPES.BinaryExpression: {
            const [left, right] = [getMode(source, value.left), getMode(source, value.right)];
            return value.operator === '|' && left !== undefined && right !== undefined ? left | right : undefined;
        }
        default: {
            return undefined;
        }
    }
}

export const filePermissions = createRule<[], 'permissive'>({
    name: 'file-permissions',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `chmod`, `fchmod`, and `lchmod` calls, and their `Sync` forms, that give other users any permission, and `process.umask` calls that do not remove every permission of other users.',
            why: 'A file that every user of the machine can read or change leaks its data or lets another process change it.',
            fix: 'Give no permission to other users: end the mode in 0, such as `0o750`, and the umask in 7, such as `0o027`.',
            example:
                'The call `fs.chmodSync("/tmp/report", 0o777)` reports `permissive`. Use `fs.chmodSync("/tmp/report", 0o750)`.',
        },
        schema: [],
        messages: { permissive: 'This mode gives other users access. Remove the permissions of other users.' },
    },
    create(context) {
        const source = context.sourceCode;
        const checkMode = (node: TSESTree.Node | undefined, allowed: number): void => {
            const mode = getMode(source, node);
            const isPermissive = mode !== undefined && !Number.isNaN(mode) && mode % OCTAL_RADIX !== allowed;
            if (node && isPermissive) context.report({ node, messageId: 'permissive' });
        };
        return {
            CallExpression(node) {
                const method = node.callee.type === AST_NODE_TYPES.MemberExpression ? node.callee.property : null;
                if (method?.type === AST_NODE_TYPES.Identifier && CHMOD_METHODS.has(method.name)) {
                    const [first, second = first] = node.arguments;
                    checkMode(second, 0);
                } else if (getQualifiedName(node, source) === UMASK_FUNCTION) checkMode(node.arguments[0], OTHERS_MASK);
            },
        };
    },
});
