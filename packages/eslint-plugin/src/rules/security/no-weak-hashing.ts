import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { DIGEST_METHOD, HASH_FUNCTIONS, SUBTLE_DIGEST, TRUNCATION_METHODS } from '../../config/security.ts';
import { getExpressionValue } from '../../language/expressions.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { createRule } from '../../rule.ts';
import type { MethodCall } from '../../types/security.ts';

function classifyIndex(index: number | null | undefined, missing: 'zero' | 'length'): 'zero' | 'length' | 'other' {
    if (index === undefined) return missing;
    return index !== null && (index <= 0 || Number.isNaN(index)) ? 'zero' : 'other';
}

function isEntireCopy(source: Readonly<TSESLint.SourceCode>, { call, method }: MethodCall): boolean {
    const [start, end] = call.arguments.map((argument) => {
        const value = ASTUtils.getStaticValue(argument, source.getScope(argument));
        return value === null ? null : Number(value.value);
    });
    const isNegativeStart = method === 'slice' && typeof start === 'number' && start < 0;
    return !isNegativeStart && classifyIndex(start, 'zero') === 'zero' && classifyIndex(end, 'length') === 'length';
}

function findMethodCall(node: TSESTree.Node): MethodCall | undefined {
    const { parent } = node;
    if (parent?.type !== AST_NODE_TYPES.MemberExpression || parent.object !== node) return undefined;
    const call = parent.parent;
    return call.type === AST_NODE_TYPES.CallExpression && call.callee === parent
        ? { call, method: ASTUtils.getPropertyName(parent) }
        : undefined;
}

function isTruncating(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): boolean {
    const methodCall = findMethodCall(node);
    const method = methodCall?.method ?? '';
    return methodCall !== undefined && TRUNCATION_METHODS.has(method) && !isEntireCopy(source, methodCall);
}

function hasOnlyTruncatedReads(source: Readonly<TSESLint.SourceCode>, name: TSESTree.Identifier): boolean {
    const variable = ASTUtils.findVariable(source.getScope(name), name);
    const reads = variable?.references.filter((reference) => reference.isRead());
    return (
        reads !== undefined &&
        reads.length > 0 &&
        reads.every((reference) => isTruncating(source, reference.identifier))
    );
}

function isStoredTruncated(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Expression): boolean {
    const { parent } = node;
    if (parent.type !== AST_NODE_TYPES.VariableDeclarator || parent.init !== node) return false;
    const { id } = parent;
    return id.type === AST_NODE_TYPES.Identifier && hasOnlyTruncatedReads(source, id);
}

function isDigestTruncated(source: Readonly<TSESLint.SourceCode>, hash: TSESTree.CallExpression): boolean {
    let digest: TSESTree.CallExpression | undefined;
    let node: TSESTree.Node = hash;
    for (let methodCall = findMethodCall(node); methodCall !== undefined; methodCall = findMethodCall(node)) {
        if (digest !== undefined && isTruncating(source, node)) return true;
        if (methodCall.method === DIGEST_METHOD) digest = methodCall.call;
        node = methodCall.call;
    }
    return digest !== undefined && isStoredTruncated(source, digest);
}

function isPromiseTruncated(source: Readonly<TSESLint.SourceCode>, digest: TSESTree.CallExpression): boolean {
    const then = findMethodCall(digest);
    const callback = then?.method === 'then' ? then.call.arguments[0] : undefined;
    const value = callback !== undefined && ASTUtils.isFunction(callback) ? callback.params[0] : undefined;
    return value?.type === AST_NODE_TYPES.Identifier && hasOnlyTruncatedReads(source, value);
}

function getAlgorithm(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): string {
    const algorithm = getExpressionValue(node, source);
    const isText = algorithm?.type === AST_NODE_TYPES.Literal && typeof algorithm.value === 'string';
    return isText ? algorithm.value.toLowerCase() : '';
}

function isTruncatedHash(node: TSESTree.CallExpression, name: string, source: Readonly<TSESLint.SourceCode>): boolean {
    if (name !== SUBTLE_DIGEST) return isDigestTruncated(source, node);
    const value = node.parent.type === AST_NODE_TYPES.AwaitExpression ? node.parent : node;
    const isBound = isStoredTruncated(source, value);
    return isPromiseTruncated(source, node) || isTruncating(source, value) || isBound;
}

export const noWeakHashing = createRule<[], 'weak'>({
    name: 'no-weak-hashing',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `crypto.createHash` calls with MD5, SHA-1, RIPEMD, or another weak algorithm, and `crypto.subtle.digest` calls with SHA-1. A digest that the code only shortens with `slice` or `substring` passes, because a short digest serves as an identifier, not as a protection.',
            why: 'Attackers can find two inputs with the same weak hash, so the hash does not protect passwords, signatures, or file integrity.',
            fix: 'Use SHA-256 or a stronger hash. Store passwords with a password hash such as scrypt or Argon2.',
            example:
                'The call `crypto.createHash("md5").update(password).digest("hex")` reports `weak`. Use `crypto.createHash("sha256")`.',
        },
        schema: [],
        messages: { weak: 'This hash algorithm is weak. Use SHA-256 or a stronger hash where the data is sensitive.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'CallExpression[arguments.length>0]': function (node: TSESTree.CallExpression) {
                const name = getQualifiedName(node, source) ?? '';
                const weak = Object.hasOwn(HASH_FUNCTIONS, name) ? HASH_FUNCTIONS[name] : undefined;
                if (weak?.has(getAlgorithm(source, node.arguments[0])) !== true) return;
                if (!isTruncatedHash(node, name, source)) context.report({ node: node.callee, messageId: 'weak' });
            },
        };
    },
});
