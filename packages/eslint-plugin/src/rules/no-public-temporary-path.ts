import { createRule } from '../rule.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    PUBLIC_TEMPORARY_FOLDERS,
    WINDOWS_TEMPORARY_FOLDERS,
    TEMPORARY_ENVIRONMENT_VARIABLES,
} from '../config/security.ts';

function isPublicTemporaryPath(text: string): boolean {
    const path = text.toLowerCase();
    if (PUBLIC_TEMPORARY_FOLDERS.some((prefix) => path.startsWith(`/${prefix}/`))) return true;
    const segments = path.split(/\\{1,2}/u);
    const folder = segments[1];
    if (folder === undefined) return false;
    return WINDOWS_TEMPORARY_FOLDERS.has(folder) || (folder === 'windows' && segments[2] === 'temp');
}

export const noPublicTemporaryPath = createRule<[], 'directory'>({
    name: 'no-public-temporary-path',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'all',
            description: 'Reports public temporary directory literals and process.env temporary-directory values.',
            why: 'Other users can create or replace files in shared writable directories.',
            fix: 'Create a private temporary directory with restrictive permissions and use its returned path.',
            example: '`mkdtemp(join(tmpdir(), "job-"))` creates a unique private directory for the job.',
        },
        schema: [],
        messages: { directory: 'Use a private directory with restrictive permissions for temporary files.' },
    },
    create(context) {
        return {
            Literal: (node) => {
                if (isPublicTemporaryPath(node.raw.slice(1, -1))) context.report({ node, messageId: 'directory' });
            },
            MemberExpression: (node) => {
                if (
                    node.property.type !== AST_NODE_TYPES.Identifier ||
                    !TEMPORARY_ENVIRONMENT_VARIABLES.has(node.property.name)
                )
                    return;
                const receiver = node.object;
                if (
                    receiver.type === AST_NODE_TYPES.MemberExpression &&
                    receiver.property.type === AST_NODE_TYPES.Identifier &&
                    receiver.property.name === 'env' &&
                    receiver.object.type === AST_NODE_TYPES.Identifier &&
                    receiver.object.name === 'process'
                )
                    context.report({ node, messageId: 'directory' });
            },
        };
    },
});
