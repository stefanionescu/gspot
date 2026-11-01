import { createRule } from '../rule.ts';
import { readQualifiedName } from '../modules.ts';
import type { SizedForm, UploadCall } from '../types/rules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    readExpressionValue,
    readOptionProperties,
    findAssignedVariable,
    findMemberAssignment,
} from '../expressions.ts';
import {
    SIZE_TEXT,
    SIZE_UNITS,
    SIZE_LIMITS,
    MULTER_MODULE,
    SIZE_DEFAULTS,
    FORMIDABLE_MODULE,
    BODY_PARSER_MODULE,
    BODY_LIMIT_OPTIONS,
} from '../config/servers.ts';

function combineSizes(operator: string, left: number, right: number): number | undefined {
    switch (operator) {
        case '*': {
            return left * right;
        }
        case '+': {
            return left + right;
        }
        case '-': {
            return left - right;
        }
        case '/': {
            return left / right;
        }
        case '**': {
            return left ** right;
        }
        default: {
            return undefined;
        }
    }
}

function parseSize(text: string): number | undefined {
    const match = SIZE_TEXT.exec(text.trim());
    if (match === null) return undefined;
    const unit = match.groups?.['unit']?.toLowerCase() ?? 'b';
    return Math.floor(Number(match.groups?.['amount']) * (SIZE_UNITS[unit] ?? 1));
}

function readSize(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): number | undefined {
    const value = readExpressionValue(node, source);
    if (value?.type === AST_NODE_TYPES.BinaryExpression) return readArithmeticSize(source, value);
    const literal = value?.type === AST_NODE_TYPES.Literal ? value.value : undefined;
    if (typeof literal === 'string') return parseSize(literal);
    return typeof literal === 'number' ? literal : undefined;
}

function readArithmeticSize(
    source: Readonly<TSESLint.SourceCode>,
    value: TSESTree.BinaryExpression,
): number | undefined {
    const [left, right] = [readSize(source, value.left), readSize(source, value.right)];
    const size = left === undefined || right === undefined ? undefined : combineSizes(value.operator, left, right);
    return size !== undefined && Number.isFinite(size) ? size : undefined;
}

function isTooLarge(
    source: Readonly<TSESLint.SourceCode>,
    property: TSESTree.Property | null | undefined,
    defaultSize: number | undefined,
    limit: number,
): boolean {
    const size = property ? readSize(source, property.value) : defaultSize;
    if (property) return size !== undefined && size > limit;
    return size === undefined || size > limit;
}

function readOptions(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
): TSESTree.ObjectExpression | undefined {
    const [argument] = node.arguments;
    const options = readExpressionValue(argument, source);
    return options?.type === AST_NODE_TYPES.ObjectExpression ? options : undefined;
}

function listOversizedForms(source: Readonly<TSESLint.SourceCode>, node: UploadCall): TSESTree.Node[] {
    const options = readOptions(source, node);
    const maximum = options && readOptionProperties(options, source).get('maxFileSize');
    return options && isTooLarge(source, maximum, SIZE_DEFAULTS.formidable, SIZE_LIMITS.upload)
        ? [maximum ?? node]
        : [];
}

function listOversizedFiles(
    source: Readonly<TSESLint.SourceCode>,
    node: UploadCall,
    limits: TSESTree.Property,
): TSESTree.Node[] {
    if (limits.value.type !== AST_NODE_TYPES.ObjectExpression) return [];
    const fileSize = readOptionProperties(limits.value, source).get('fileSize');
    return isTooLarge(source, fileSize, undefined, SIZE_LIMITS.upload) ? [fileSize ?? node] : [];
}

function listOversizedUploads(source: Readonly<TSESLint.SourceCode>, node: UploadCall): TSESTree.Node[] {
    const options = readOptions(source, node);
    const limits = options && readOptionProperties(options, source).get('limits');
    if (node.arguments.length === 0 || (options && !limits)) return [node.callee];
    return limits ? listOversizedFiles(source, node, limits) : [];
}

function listOversizedBodies(source: Readonly<TSESLint.SourceCode>, node: UploadCall): TSESTree.Node[] {
    const options = readOptions(source, node);
    const limit =
        options && BODY_LIMIT_OPTIONS.map((key) => readOptionProperties(options, source).get(key)).find(Boolean);
    return options && isTooLarge(source, limit, SIZE_DEFAULTS.bodyParser, SIZE_LIMITS.standard) ? [limit ?? node] : [];
}

function readUploadModule(source: Readonly<TSESLint.SourceCode>, node: UploadCall): string | undefined {
    const { callee } = node;
    const origin = callee.type === AST_NODE_TYPES.MemberExpression ? callee.object : callee;
    const name = ASTUtils.isIdentifier(origin) ? readQualifiedName(origin, source) : undefined;
    const [module] = (name ?? '').split('.');
    return module !== MULTER_MODULE || (name === MULTER_MODULE && callee === origin) ? module : undefined;
}

function listOversizedNodes(source: Readonly<TSESLint.SourceCode>, node: UploadCall): TSESTree.Node[] {
    const module = readUploadModule(source, node);
    if (module === FORMIDABLE_MODULE) return listOversizedForms(source, node);
    if (module === BODY_PARSER_MODULE) return listOversizedBodies(source, node);
    return module === MULTER_MODULE ? listOversizedUploads(source, node) : [];
}

export const contentLength = createRule<[], 'unlimited'>({
    name: 'content-length',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds request size limits above 8 MB for file uploads with `formidable` and `multer`, and above 2 MB for other requests with `body-parser`, also when the limit stays at a larger default or is missing.',
            why: 'A server that accepts very large requests lets a client fill its memory or disk and stop it from serving other users.',
            fix: 'Set a limit that fits the largest request the route needs: `maxFileSize` for `formidable`, `limits.fileSize` for `multer`, and `limit` for `body-parser`.',
            example:
                'The call `multer({ dest: "uploads/" })` reports `unlimited`. Use `multer({ dest: "uploads/", limits: { fileSize: 4_000_000 } })`.',
        },
        schema: [],
        messages: { unlimited: 'Limit the size of the request content here.' },
    },
    create(context) {
        const source = context.sourceCode;
        const forms = new Map<TSESLint.Scope.Variable, SizedForm>();
        return {
            'CallExpression, NewExpression'(node: UploadCall) {
                for (const oversized of listOversizedNodes(source, node))
                    context.report({ node: oversized, messageId: 'unlimited' });
                const isForm = node.arguments.length === 0 && readUploadModule(source, node) === FORMIDABLE_MODULE;
                const variable = isForm ? findAssignedVariable(node, source) : null;
                if (variable) forms.set(variable, { node, size: SIZE_DEFAULTS.formidable });
            },
            AssignmentExpression(node) {
                const assignment = findMemberAssignment(node, source);
                const form = assignment?.property === 'maxFileSize' ? forms.get(assignment.variable) : undefined;
                if (assignment === undefined || form === undefined) return;
                const size = readSize(source, node.right);
                if (size === undefined || size === 0) forms.delete(assignment.variable);
                else Object.assign(form, { node, size });
            },
            'Program:exit'() {
                for (const { node, size } of forms.values())
                    if (size > SIZE_LIMITS.upload) context.report({ node, messageId: 'unlimited' });
            },
        };
    },
});
