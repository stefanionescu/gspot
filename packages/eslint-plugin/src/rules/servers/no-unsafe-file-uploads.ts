import { createRule } from '../../rule.ts';
import type { UploadForm } from '../../types/security.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { MULTER_MODULE, UPLOAD_MESSAGES, FORMIDABLE_MODULE } from '../../config/servers.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    getExpressionValue,
    getOptionProperties,
    findAssignedVariable,
    findMemberAssignment,
} from '../../language/expressions.ts';

function getOption(source: Readonly<TSESLint.SourceCode>, options: TSESTree.Node | undefined, key: string) {
    const literal = getExpressionValue(options, source);
    if (literal?.type !== AST_NODE_TYPES.ObjectExpression) return undefined;
    return getOptionProperties(literal, source).get(key);
}

export const noUnsafeFileUploads = createRule<[], 'folder' | 'extension' | 'extensionAndFolder'>({
    name: 'no-unsafe-file-uploads',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `formidable` forms without an `uploadDir` or with `keepExtensions: true`, and `multer.diskStorage` storages without a `destination`.',
            why: 'An uploaded file that lands in a shared folder, or that keeps an extension such as `.html` or `.js`, can be served or run by the server.',
            fix: 'Set an upload folder that the server never serves, and give stored files a name and extension that the server chooses.',
            example:
                'The call `formidable({ keepExtensions: true })` reports `extensionAndFolder`. Use `formidable({ uploadDir: "/var/uploads" })`.',
        },
        schema: [],
        messages: {
            folder: 'Restrict the folder of uploaded files.',
            extension: 'Restrict the extension of uploaded files.',
            extensionAndFolder: 'Restrict the extension and the folder of uploaded files.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const forms = new Map<TSESLint.Scope.Variable, UploadForm>();
        const report = (node: TSESTree.Node, hasFolder: boolean, hasExtensions: boolean): void => {
            const key = `${String(hasFolder)},${String(hasExtensions)}`;
            const messageId = Object.hasOwn(UPLOAD_MESSAGES, key) ? UPLOAD_MESSAGES[key] : undefined;
            if (messageId) context.report({ node, messageId });
        };
        const checkFormidable = (node: TSESTree.CallExpression | TSESTree.NewExpression): void => {
            const variable = node.arguments.length === 0 ? findAssignedVariable(node, source) : null;
            if (variable) forms.set(variable, { node: node.callee, hasFolder: false, keepsExtensions: false });
            if (node.arguments.length === 0) return;
            const extensions = getOption(source, node.arguments[0], 'keepExtensions');
            const hasFolder = Boolean(getOption(source, node.arguments[0], 'uploadDir'));
            report(
                node.callee,
                hasFolder,
                extensions?.value.type === AST_NODE_TYPES.Literal && extensions.value.value === true,
            );
        };
        const checkMulter = (node: TSESTree.CallExpression | TSESTree.NewExpression): void => {
            const storage = getExpressionValue(getOption(source, node.arguments[0], 'storage')?.value, source);
            const isDisk =
                storage?.type === AST_NODE_TYPES.CallExpression &&
                storage.arguments.length > 0 &&
                storage.callee.type === AST_NODE_TYPES.MemberExpression &&
                ASTUtils.getPropertyName(storage.callee) === 'diskStorage';
            if (isDisk && !getOption(source, storage.arguments[0], 'destination')) report(node.callee, false, false);
        };
        return {
            'CallExpression, NewExpression'(node: TSESTree.CallExpression | TSESTree.NewExpression) {
                const [module] =
                    node.callee.type === AST_NODE_TYPES.Identifier
                        ? (getQualifiedName(node.callee, source) ?? '').split('.')
                        : [];
                if (module === FORMIDABLE_MODULE) checkFormidable(node);
                else if (module === MULTER_MODULE) checkMulter(node);
            },
            AssignmentExpression(node) {
                const assignment = findMemberAssignment(node, source);
                const form = assignment ? forms.get(assignment.variable) : undefined;
                if (form === undefined || assignment === undefined) return;
                if (assignment.property === 'uploadDir') form.hasFolder = true;
                else if (assignment.property === 'keepExtensions')
                    form.keepsExtensions = node.right.type === AST_NODE_TYPES.Literal && node.right.value === true;
            },
            'Program:exit'() {
                for (const { node, hasFolder, keepsExtensions } of forms.values())
                    report(node, hasFolder, keepsExtensions);
            },
        };
    },
});
