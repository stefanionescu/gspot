import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    BODY_LIMIT_OPTIONS,
    BODY_PARSER_MODULE,
    FORMIDABLE_MODULE,
    MULTER_MODULE,
    SIZE_DEFAULTS,
    SIZE_LIMITS,
    SIZE_TEXT,
    SIZE_UNITS,
} from '../../config/servers.ts';
import {
    findAssignedVariable,
    findMemberAssignment,
    getExpressionValue,
    getOptionProperties,
} from '../../language/expressions.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { createRule } from '../../rule.ts';
import type { CallNode } from '../../types/plugin.ts';
import type { SizedForm } from '../../types/security.ts';

function parseSize(text: string): number | undefined {
    const match = SIZE_TEXT.exec(text.trim());
    if (match === null) return undefined;
    const unit = match.groups?.['unit']?.toLowerCase() ?? '';
    return Math.floor(Number(match.groups?.['amount']) * (SIZE_UNITS[unit] ?? 1));
}

function getSize(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): number | undefined {
    const value = ASTUtils.getStaticValue(node, source.getScope(node))?.value;
    if (typeof value === 'string') return parseSize(value);
    return typeof value === 'number' ? value : undefined;
}

function isTooLarge(
    source: Readonly<TSESLint.SourceCode>,
    property: TSESTree.Property | null | undefined,
    defaultSize: number | undefined,
    limit: number,
): boolean {
    const size = property ? getSize(source, property.value) : defaultSize;
    if (property) return size !== undefined && size > limit;
    return size === undefined || size > limit;
}

function getOptions(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
): TSESTree.ObjectExpression | undefined {
    const [argument] = node.arguments;
    const options = getExpressionValue(argument, source);
    return options?.type === AST_NODE_TYPES.ObjectExpression ? options : undefined;
}

function listOversizedForms(source: Readonly<TSESLint.SourceCode>, node: CallNode): TSESTree.Node[] {
    const options = getOptions(source, node);
    const maximum = options && getOptionProperties(options, source).get('maxFileSize');
    return options && isTooLarge(source, maximum, SIZE_DEFAULTS.formidable, SIZE_LIMITS.upload)
        ? [maximum ?? node]
        : [];
}

function listOversizedFiles(
    source: Readonly<TSESLint.SourceCode>,
    node: CallNode,
    limits: TSESTree.Property,
): TSESTree.Node[] {
    if (limits.value.type !== AST_NODE_TYPES.ObjectExpression) return [];
    const fileSize = getOptionProperties(limits.value, source).get('fileSize');
    return isTooLarge(source, fileSize, undefined, SIZE_LIMITS.upload) ? [fileSize ?? node] : [];
}

function listOversizedUploads(source: Readonly<TSESLint.SourceCode>, node: CallNode): TSESTree.Node[] {
    const options = getOptions(source, node);
    const limits = options && getOptionProperties(options, source).get('limits');
    if (node.arguments.length === 0 || (options && !limits)) return [node.callee];
    return limits ? listOversizedFiles(source, node, limits) : [];
}

function listOversizedBodies(source: Readonly<TSESLint.SourceCode>, node: CallNode): TSESTree.Node[] {
    const options = getOptions(source, node);
    const limit =
        options && BODY_LIMIT_OPTIONS.map((key) => getOptionProperties(options, source).get(key)).find(Boolean);
    return limit && isTooLarge(source, limit, undefined, SIZE_LIMITS.standard) ? [limit] : [];
}

function getUploadModule(source: Readonly<TSESLint.SourceCode>, node: CallNode): string | undefined {
    const { callee } = node;
    const origin = callee.type === AST_NODE_TYPES.MemberExpression ? callee.object : callee;
    const name = getQualifiedName(origin, source);
    const [module] = (name ?? '').split('.', 1);
    return module !== MULTER_MODULE || (name === MULTER_MODULE && callee === origin) ? module : undefined;
}

function listOversizedNodes(source: Readonly<TSESLint.SourceCode>, node: CallNode): TSESTree.Node[] {
    const module = getUploadModule(source, node);
    if (module === FORMIDABLE_MODULE) return listOversizedForms(source, node);
    if (module === BODY_PARSER_MODULE) return listOversizedBodies(source, node);
    return module === MULTER_MODULE ? listOversizedUploads(source, node) : [];
}

function setFormSize(
    forms: Map<TSESLint.Scope.Variable, SizedForm>,
    node: TSESTree.AssignmentExpression,
    source: Readonly<TSESLint.SourceCode>,
): void {
    const assignment = findMemberAssignment(node, source);
    const form = assignment?.property === 'maxFileSize' ? forms.get(assignment.variable) : undefined;
    if (assignment === undefined || form === undefined) return;
    const size = getSize(source, node.right);
    if (size === undefined || size === 0) forms.delete(assignment.variable);
    else Object.assign(form, { node, size });
}

export const maxRequestSize = createRule<[], 'unlimited'>({
    name: 'max-request-size',
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
            'CallExpression, NewExpression'(node: CallNode) {
                for (const oversized of listOversizedNodes(source, node))
                    context.report({ node: oversized, messageId: 'unlimited' });
                const isForm = node.arguments.length === 0 && getUploadModule(source, node) === FORMIDABLE_MODULE;
                const variable = isForm ? findAssignedVariable(node, source) : null;
                if (variable) forms.set(variable, { node, size: SIZE_DEFAULTS.formidable });
            },
            AssignmentExpression: (node) => {
                setFormSize(forms, node, source);
            },
            'Program:exit'() {
                for (const { node, size } of forms.values())
                    if (size > SIZE_LIMITS.upload) context.report({ node, messageId: 'unlimited' });
            },
        };
    },
});
