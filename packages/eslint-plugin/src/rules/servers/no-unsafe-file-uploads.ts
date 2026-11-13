import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { FORMIDABLE_MODULE, MULTER_MODULE, UPLOAD_MESSAGES } from '../../config/servers.ts';
import { getExpressionValue, getOptionProperties } from '../../language/expressions.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { findAssignedVariable, findMemberAssignment } from '../../language/variables.ts';
import { createRule } from '../../rule.ts';
import type { UploadForm } from '../../types/security.ts';

function setFormOption(form: UploadForm, property: string, value: TSESTree.Expression): void {
    if (property === 'uploadDir') form.hasFolder = true;
    else if (property === 'keepExtensions')
        form.keepsExtensions = value.type === AST_NODE_TYPES.Literal && value.value === true;
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
        const report = (
            node: TSESTree.Node,
            { hasFolder, keepsExtensions }: Pick<UploadForm, 'hasFolder' | 'keepsExtensions'>,
        ): void => {
            const key = `${String(hasFolder)},${String(keepsExtensions)}`;
            const messageId = Object.hasOwn(UPLOAD_MESSAGES, key) ? UPLOAD_MESSAGES[key] : undefined;
            if (messageId) context.report({ node, messageId });
        };
        const checkFormidable = (node: TSESTree.CallExpression | TSESTree.NewExpression): void => {
            const variable = node.arguments.length === 0 ? findAssignedVariable(node, source) : null;
            if (variable) forms.set(variable, { node: node.callee, hasFolder: false, keepsExtensions: false });
            if (node.arguments.length === 0) return;
            const extensions = getOptionProperties(node.arguments[0], source).get('keepExtensions');
            const hasFolder = Boolean(getOptionProperties(node.arguments[0], source).get('uploadDir'));
            report(node.callee, {
                hasFolder,
                keepsExtensions: extensions?.value.type === AST_NODE_TYPES.Literal && extensions.value.value === true,
            });
        };
        const checkMulter = (node: TSESTree.CallExpression | TSESTree.NewExpression): void => {
            const storage = getExpressionValue(
                getOptionProperties(node.arguments[0], source).get('storage')?.value,
                source,
            );
            const isDisk =
                storage?.type === AST_NODE_TYPES.CallExpression &&
                storage.arguments.length > 0 &&
                storage.callee.type === AST_NODE_TYPES.MemberExpression &&
                ASTUtils.getPropertyName(storage.callee) === 'diskStorage';
            if (isDisk && !getOptionProperties(storage.arguments[0], source).get('destination'))
                report(node.callee, { hasFolder: false, keepsExtensions: false });
        };
        return {
            'CallExpression, NewExpression': function (node: TSESTree.CallExpression | TSESTree.NewExpression) {
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
                setFormOption(form, assignment.property, node.right);
            },
            'Program:exit': function () {
                for (const form of forms.values()) report(form.node, form);
            },
        };
    },
});
