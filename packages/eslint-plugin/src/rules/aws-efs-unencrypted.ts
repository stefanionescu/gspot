import { createRule } from '../rule.ts';
import { EFS_CHECKS } from '../config/aws.ts';
import { listCdkTableIssues } from '../aws.ts';

export const awsEfsUnencrypted = createRule<[], 'omitted' | 'invalid'>({
    name: 'aws-efs-unencrypted',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `new efs.FileSystem` constructions with `encrypted: false`, and `new efs.CfnFileSystem` constructions that leave out `encrypted` or do not set it to `true`.',
            why: 'An unencrypted file system exposes its files to anyone who gets a copy of its storage or backups.',
            fix: 'Set `encrypted: true`, or leave it out of `efs.FileSystem`, whose default encrypts.',
            example:
                'The construction `new efs.FileSystem(this, "Files", { vpc, encrypted: false })` reports `invalid`. Remove `encrypted: false`.',
        },
        schema: [],
        messages: {
            omitted: 'Leaving out {{property}} stores this EFS file system unencrypted. Set {{property}} to true.',
            invalid: 'This EFS file system is stored unencrypted. Set {{property}} to true.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            NewExpression(node) {
                const issues = listCdkTableIssues(source, node, EFS_CHECKS);
                for (const { node: target, kind, property } of issues)
                    context.report({ node: target, messageId: kind, data: { property } });
            },
        };
    },
});
