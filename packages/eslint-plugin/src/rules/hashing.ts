import { createRule } from '../rule.ts';
import { readQualifiedName } from '../modules.ts';
import type { MethodCall } from '../types/rules.ts';
import { readExpressionValue } from '../expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { DIGEST_METHOD, SUBTLE_DIGEST, HASH_FUNCTIONS, TRUNCATION_METHODS } from '../config/security.ts';

function readIndex(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): number | null | undefined {
    const value =
        node.type === AST_NODE_TYPES.SpreadElement ? null : ASTUtils.getStaticValue(node, source.getScope(node));
    if (value === null || (typeof value.value === 'object' && value.value !== null)) return null;
    return value.value === undefined ? undefined : Number(value.value);
}

function classifyIndex(index: number | null | undefined, missing: 'zero' | 'length'): 'zero' | 'length' | 'other' {
    if (index === undefined) return missing;
    if (index === Infinity) return 'length';
    return index !== null && (index <= 0 || Number.isNaN(index)) ? 'zero' : 'other';
}

function isEntireCopy(source: Readonly<TSESLint.SourceCode>, { call, method }: MethodCall): boolean {
    if (call.arguments.length === 0) return true;
    const [start, end] = call.arguments.map((argument) => readIndex(source, argument));
    const isNegativeStart = method === 'slice' && typeof start === 'number' && start < 0;
    const kinds = `${classifyIndex(start, 'zero')},${call.arguments.length === 1 ? 'length' : classifyIndex(end, 'length')}`;
    return !isNegativeStart && (kinds === 'zero,length' || (method === 'substring' && kinds === 'length,zero'));
}

function findMethodCall(node: TSESTree.Node): MethodCall | undefined {
    const { parent } = node;
    if (parent?.type !== AST_NODE_TYPES.MemberExpression || parent.object !== node) return undefined;
    const call = parent.parent;
    return call.type === AST_NODE_TYPES.CallExpression && call.callee === parent
        ? { call, method: ASTUtils.getPropertyName(parent) ?? '' }
        : undefined;
}

function isTruncating(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): boolean {
    const methodCall = findMethodCall(node);
    const method = methodCall?.method ?? '';
    return methodCall !== undefined && TRUNCATION_METHODS.has(method) && !isEntireCopy(source, methodCall);
}

function hasOnlyTruncatedReads(source: Readonly<TSESLint.SourceCode>, name: TSESTree.Identifier): boolean {
    const variable = ASTUtils.findVariable(source.getScope(name), name);
    const reads = variable?.references.filter((reference) => reference.isRead()) ?? [];
    return reads.length > 0 && reads.every((reference) => isTruncating(source, reference.identifier));
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

function readAlgorithm(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): string {
    const algorithm = readExpressionValue(node, source);
    const isText = algorithm?.type === AST_NODE_TYPES.Literal && typeof algorithm.value === 'string';
    return isText ? algorithm.value.toLowerCase() : '';
}

export const hashing = createRule<[], 'weak'>({
    name: 'hashing',
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
        const isTruncatedSubtle = (digest: TSESTree.CallExpression): boolean => {
            const value = digest.parent.type === AST_NODE_TYPES.AwaitExpression ? digest.parent : digest;
            const isBound = isStoredTruncated(source, value);
            return isPromiseTruncated(source, digest) || isTruncating(source, value) || isBound;
        };
        return {
            'CallExpression[arguments.length>0]'(node: TSESTree.CallExpression) {
                const name = readQualifiedName(node, source) ?? '';
                const weak = Object.hasOwn(HASH_FUNCTIONS, name) ? HASH_FUNCTIONS[name] : undefined;
                if (weak?.has(readAlgorithm(source, node.arguments[0])) !== true) return;
                const isTruncated = name === SUBTLE_DIGEST ? isTruncatedSubtle(node) : isDigestTruncated(source, node);
                if (!isTruncated) context.report({ node: node.callee, messageId: 'weak' });
            },
        };
    },
});
