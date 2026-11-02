import { createRule } from '../rule.ts';
import { listArgumentValues } from '../expressions.ts';
import type { PolicyStatement } from '../types/plugin.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { getCdkName, listCdkStrings, readCdkProperty, listAllowStatements } from '../aws.ts';
import { ANY_PRINCIPAL, ARN_PRINCIPAL, ANY_PRINCIPALS, JSON_PRINCIPAL_KEY } from '../config/aws.ts';

function findPublicPrincipal(
    source: Readonly<TSESLint.SourceCode>,
    policy: PolicyStatement,
): TSESTree.Node | undefined {
    const principals = readCdkProperty(source, policy.statement, policy.keys.principals);
    if (policy.keys.isJson)
        return listCdkStrings(
            source,
            principals.node.type === AST_NODE_TYPES.Literal
                ? principals
                : readCdkProperty(source, principals, JSON_PRINCIPAL_KEY),
        ).find(({ value }) => value === ANY_PRINCIPAL);
    return listArgumentValues([principals.node], source).find((element) => {
        if (element.type !== AST_NODE_TYPES.NewExpression) return false;
        const name = getCdkName(source, element.callee);
        const [arn] = element.arguments;
        return (
            ANY_PRINCIPALS.has(name) ||
            (name === ARN_PRINCIPAL && arn?.type === AST_NODE_TYPES.Literal && arn.value === ANY_PRINCIPAL)
        );
    });
}

export const awsIamPublicAccess = createRule<[], 'publicPrincipal'>({
    name: 'aws-iam-public-access',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds IAM policy statements that allow any principal: `new iam.StarPrincipal()`, `new iam.AnyPrincipal()`, `new iam.ArnPrincipal("*")`, or a JSON `Principal` of `*` or `{ AWS: "*" }`.',
            why: 'A policy that allows any principal lets every AWS account, and often anyone on the internet, use the resource.',
            fix: 'Name the accounts, roles, or services that need access as principals.',
            example:
                'The statement `new iam.PolicyStatement({ principals: [new iam.AnyPrincipal()], actions, resources })` reports `publicPrincipal`. Use `principals: [new iam.AccountPrincipal(accountId)]`.',
        },
        schema: [],
        messages: {
            publicPrincipal: 'Make sure that granting public access is safe here. Name the trusted principals.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'NewExpression, CallExpression'(node: TSESTree.NewExpression | TSESTree.CallExpression) {
                const principals = listAllowStatements(source, node).map((policy) =>
                    findPublicPrincipal(source, policy),
                );
                for (const principal of principals)
                    if (principal) context.report({ node: principal, messageId: 'publicPrincipal' });
            },
        };
    },
});
