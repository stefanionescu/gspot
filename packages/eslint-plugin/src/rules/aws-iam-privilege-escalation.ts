import { createRule } from '../rule.ts';
import type { PolicyStatement } from '../types/plugin.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESCALATION_ACTIONS, ESCALATION_RESOURCE } from '../config/aws.ts';
import { listCdkStrings, getCdkProperty, listAllowStatements } from '../aws.ts';

function findEscalation(
    source: Readonly<TSESLint.SourceCode>,
    { statement, keys }: PolicyStatement,
): TSESLint.ReportDescriptor<'escalation'> | undefined {
    const isLimited = [keys.principals, keys.conditions].some(
        (key) => getCdkProperty(source, statement, key).status !== 'missing',
    );
    const resource = listCdkStrings(source, getCdkProperty(source, statement, keys.resources)).find(({ value }) =>
        ESCALATION_RESOURCE.test(value),
    );
    const action = listCdkStrings(source, getCdkProperty(source, statement, keys.actions)).find(({ value }) =>
        ESCALATION_ACTIONS.has(value),
    );
    return !isLimited && resource && action
        ? { node: resource, messageId: 'escalation', data: { action: action.value } }
        : undefined;
}

export const awsIamPrivilegeEscalation = createRule<[], 'escalation'>({
    name: 'aws-iam-privilege-escalation',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds IAM policy statements without principals or conditions that allow an action that can raise privileges, such as `iam:PassRole` or `iam:AttachUserPolicy`, on every resource or on every role, user, or group.',
            why: 'These actions on every resource let the holder of the policy give itself more permissions, up to full control of the account.',
            fix: 'Remove the action, or limit `resources` to the specific roles, users, or groups that the task needs.',
            example:
                'The statement `new iam.PolicyStatement({ actions: ["iam:PassRole"], resources: ["*"] })` reports `escalation`. Use `resources: [role.roleArn]`.',
        },
        schema: [],
        messages: {
            escalation:
                'This policy allows the "{{action}}" privilege escalation. Remove the permission or limit its resources.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'NewExpression, CallExpression'(node: TSESTree.NewExpression | TSESTree.CallExpression) {
                const escalations = listAllowStatements(source, node).map((policy) => findEscalation(source, policy));
                for (const escalation of escalations) if (escalation) context.report(escalation);
            },
        };
    },
});
