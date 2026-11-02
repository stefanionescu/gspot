import { createRule } from '../rule.ts';
import { ANY_PRINCIPAL } from '../config/aws.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { listCdkStrings, getCdkProperty, listAllowStatements } from '../libraries/aws.ts';

export const awsIamAllPrivileges = createRule<[], 'allActions'>({
    name: 'aws-iam-all-privileges',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds IAM policy statements that allow every action with `*`: `new iam.PolicyStatement`, `iam.PolicyStatement.fromJson`, and the statements of `iam.PolicyDocument.fromJson`.',
            why: 'A policy that allows every action gives far more power than any task needs, so a stolen credential can do anything.',
            fix: 'List only the actions that the task needs, such as `s3:GetObject`.',
            example:
                'The statement `new iam.PolicyStatement({ actions: ["*"], resources: [bucket.bucketArn] })` reports `allActions`. Use `actions: ["s3:GetObject"]`.',
        },
        schema: [],
        messages: { allActions: 'Make sure that granting every action is safe here. List only the needed actions.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'NewExpression, CallExpression'(node: TSESTree.NewExpression | TSESTree.CallExpression) {
                for (const { statement, keys } of listAllowStatements(source, node)) {
                    const actions = getCdkProperty(source, statement, keys.actions);
                    const action = listCdkStrings(source, actions).find(({ value }) => value === ANY_PRINCIPAL);
                    if (action) context.report({ node: action, messageId: 'allActions' });
                }
            },
        };
    },
});
