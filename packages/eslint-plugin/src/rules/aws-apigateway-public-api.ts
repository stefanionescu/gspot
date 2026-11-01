import { createRule } from '../rule.ts';
import { readExpressionValue } from '../values.ts';
import { CDK_PROPS_POSITION } from '../config/plugin.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { getCdkName, readCdkResult, readCdkArgument, readCdkProperty, listCdkTableIssues } from '../aws.ts';

import {
    REST_API,
    ADD_METHOD,
    ADD_RESOURCE,
    METHOD_CHECKS,
    ROOT_RESOURCE,
    RESOURCE_CHAIN,
    RESOURCE_METHODS,
    NO_AUTHORIZATION,
} from '../config/networks.ts';

function findDefaultAuthorization(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    position: number,
): TSESTree.Node | undefined {
    const options = readCdkArgument(source, readCdkResult(source, node), position);
    const authorization = readCdkProperty(
        source,
        readCdkProperty(source, options, 'defaultMethodOptions'),
        'authorizationType',
    );
    return authorization.status === 'found' ? authorization.node : undefined;
}

function stepResource(resource: TSESTree.Node): TSESTree.Node | undefined {
    const { type } = resource;
    if (type === AST_NODE_TYPES.CallExpression)
        return resource.callee.type === AST_NODE_TYPES.MemberExpression && !resource.callee.computed
            ? resource.callee
            : undefined;
    return type === AST_NODE_TYPES.MemberExpression && RESOURCE_CHAIN.has(ASTUtils.getPropertyName(resource))
        ? resource.object
        : undefined;
}

function readResourceMethod(name: string): string | undefined {
    const methods = name.startsWith(ROOT_RESOURCE) ? name.slice(ROOT_RESOURCE.length).split('.') : [];
    const isChain = methods.length > 0 && methods.every((method) => RESOURCE_METHODS.has(method));
    return isChain ? methods.at(-1) : undefined;
}

export const awsApigatewayPublicApi = createRule<[], 'omitted' | 'invalid'>({
    name: 'aws-apigateway-public-api',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds API Gateway methods and routes without authorization: `CfnMethod` and `CfnRoute` constructions that leave out `authorizationType` or set it to `NONE`, and `addMethod` calls on a `RestApi` resource tree with `AuthorizationType.NONE` or with neither their own `authorizationType` nor a default one.',
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
            let resource = readExpressionValue(callee, source);
            while (resource !== undefined && !defaults.has(resource)) {
                const next = stepResource(resource);
                resource = next && readExpressionValue(next, source);
            }
            return resource && defaults.get(resource);
        };
        const checkMethod = (node: TSESTree.CallExpression): void => {
            const authorization = readCdkProperty(
                source,
                readCdkArgument(source, readCdkResult(source, node), CDK_PROPS_POSITION),
                'authorizationType',
            );
            const inherited = authorization.status === 'missing' ? findDefault(node.callee) : undefined;
            if (authorization.status === 'found' && getCdkName(source, authorization.node) === NO_AUTHORIZATION)
                context.report({ node: authorization.node, messageId: 'invalid' });
            else if (authorization.status === 'missing' && inherited === undefined)
                context.report({ node: authorization.node, messageId: 'omitted' });
            else if (inherited && getCdkName(source, inherited) === NO_AUTHORIZATION)
                context.report({ node, messageId: 'invalid' });
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
            CallExpression(node) {
                const method = readResourceMethod(getCdkName(source, node.callee) ?? '');
                const authorization = method === ADD_RESOURCE ? findDefaultAuthorization(source, node, 1) : undefined;
                if (authorization) defaults.set(node, authorization);
                if (method === ADD_METHOD && node.arguments.every(({ type }) => type !== AST_NODE_TYPES.SpreadElement))
                    checkMethod(node);
            },
        };
    },
});
