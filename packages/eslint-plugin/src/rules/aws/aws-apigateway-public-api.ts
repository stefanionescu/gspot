import { createRule } from '../../rule.ts';
import type { CdkIssue, CdkResult } from '../../types/aws.ts';
import { getExpressionValue } from '../../language/expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { getCdkName, getCdkResult, getCdkArgument, getCdkProperty, listCdkTableIssues } from '../../libraries/aws.ts';

import {
    REST_API,
    ADD_METHOD,
    ADD_RESOURCE,
    METHOD_CHECKS,
    ROOT_RESOURCE,
    RESOURCE_CHAIN,
    NO_AUTHORIZATION,
    RESOURCE_METHODS,
    CDK_PROPS_POSITION,
} from '../../config/aws.ts';

function findDefaultAuthorization(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    position: number,
): TSESTree.Node | undefined {
    const options = getCdkArgument(source, getCdkResult(source, node), position);
    const authorization = getCdkProperty(
        source,
        getCdkProperty(source, options, 'defaultMethodOptions'),
        'authorizationType',
    );
    return authorization.status === 'found' ? authorization.node : undefined;
}

function stepResource(resource: TSESTree.Node): TSESTree.Node | undefined {
    const { type } = resource;
    if (type === AST_NODE_TYPES.CallExpression) return resource.callee;
    return type === AST_NODE_TYPES.MemberExpression && RESOURCE_CHAIN.has(ASTUtils.getPropertyName(resource))
        ? resource.object
        : undefined;
}

function getResourceMethod(name: string | undefined): string | undefined {
    if (name?.startsWith(ROOT_RESOURCE) !== true) return undefined;
    const methods = name.slice(ROOT_RESOURCE.length).split('.');
    return methods.every((method) => RESOURCE_METHODS.has(method)) ? methods.at(-1) : undefined;
}

function findAuthorizationIssue(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression,
    authorization: CdkResult,
    inherited: TSESTree.Node | undefined,
): CdkIssue | undefined {
    if (authorization.status === 'found' && getCdkName(source, authorization.node) === NO_AUTHORIZATION)
        return { node: authorization.node, kind: 'invalid' };
    if (authorization.status !== 'missing') return undefined;
    if (inherited === undefined) return { node: authorization.node, kind: 'omitted' };
    return getCdkName(source, inherited) === NO_AUTHORIZATION ? { node, kind: 'invalid' } : undefined;
}

export const awsApigatewayPublicApi = createRule<[], 'omitted' | 'invalid'>({
    name: 'aws-apigateway-public-api',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds API Gateway methods and routes without authorization, such as a `CfnMethod` or `CfnRoute` without an `authorizationType`, or an `addMethod` call with `AuthorizationType.NONE`.',
            why: 'A method without authorization lets anyone on the internet call the API.',
            fix: 'Set `authorizationType` to an authorizer, such as `AuthorizationType.IAM` or `AuthorizationType.COGNITO`, on the method or in `defaultMethodOptions`.',
            example:
                'The call `api.root.addMethod("GET", integration)` reports `omitted` when the API has no default authorization. Pass `{ authorizationType: apigateway.AuthorizationType.IAM }`.',
        },
        schema: [],
        messages: {
            omitted: 'Leaving out authorizationType turns off authentication. Make sure that this is safe here.',
            invalid: 'Make sure that creating a public API is safe here.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const defaults = new Map<TSESTree.Node, TSESTree.Node>();
        const findDefault = (callee: TSESTree.Node): TSESTree.Node | undefined => {
            let resource = getExpressionValue(callee, source);
            while (resource !== undefined && !defaults.has(resource)) {
                const next = stepResource(resource);
                resource = next && getExpressionValue(next, source);
            }
            return resource && defaults.get(resource);
        };
        const checkMethod = (node: TSESTree.CallExpression): void => {
            const authorization = getCdkProperty(
                source,
                getCdkArgument(source, getCdkResult(source, node), CDK_PROPS_POSITION),
                'authorizationType',
            );
            const inherited = authorization.status === 'missing' ? findDefault(node.callee) : undefined;
            const issue = findAuthorizationIssue(source, node, authorization, inherited);
            if (issue !== undefined) context.report({ node: issue.node, messageId: issue.kind });
        };
        return {
            NewExpression(node) {
                const authorization =
                    getCdkName(source, node.callee) === REST_API
                        ? findDefaultAuthorization(source, node, CDK_PROPS_POSITION)
                        : undefined;
                if (authorization) defaults.set(node, authorization);
                for (const { node: target, kind } of listCdkTableIssues(source, node, METHOD_CHECKS))
                    context.report({ node: target, messageId: kind });
            },
            'CallExpression:exit'(node: TSESTree.CallExpression) {
                const method = getResourceMethod(getCdkName(source, node.callee));
                const authorization = method === ADD_RESOURCE ? findDefaultAuthorization(source, node, 1) : undefined;
                if (authorization) defaults.set(node, authorization);
                if (method === ADD_METHOD && node.arguments.every(({ type }) => type !== AST_NODE_TYPES.SpreadElement))
                    checkMethod(node);
            },
        };
    },
});
