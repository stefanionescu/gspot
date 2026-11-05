import { AST_NODE_TYPES, type TSESLint } from '@typescript-eslint/utils';

import { CDK_PROPS_POSITION, SEARCH_DOMAINS, SEARCH_ENGINES } from '../../config/aws.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { getCdkArgument, getCdkName, getCdkProperty, getCdkResult } from '../../libraries/aws.ts';
import { createRule } from '../../rule.ts';
import type { CdkResult } from '../../types/aws.ts';

function detectEngine(
    source: Readonly<TSESLint.SourceCode>,
    version: CdkResult,
    domain: { version: string; isText: boolean; engine: string },
): string {
    const { node } = version;
    const isText = domain.isText && node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string';
    const name = isText ? `${domain.version}.${node.value}` : getQualifiedName(node, source);
    const segments = (name ?? '').toLowerCase().split('.').toReversed();
    const segment = segments.find((label) => SEARCH_ENGINES.some(([key]) => label.includes(key)));
    return SEARCH_ENGINES.find(([key]) => segment?.includes(key) === true)?.[1] ?? domain.engine;
}

export const awsOpensearchserviceDomain = createRule<[], 'omitted' | 'unencrypted'>({
    name: 'aws-opensearchservice-domain',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds OpenSearch and Elasticsearch domain constructions whose encryption at rest is missing or has `enabled: false`.',
            why: 'An unencrypted search domain exposes its indexed data to anyone who gets a copy of its storage or snapshots.',
            fix: 'Set `encryptionAtRest: { enabled: true }`, or `encryptionAtRestOptions: { enabled: true }` for a `CfnDomain`.',
            example:
                'The construction `new opensearch.Domain(this, "Search", { version })` reports `omitted`. Add `encryptionAtRest: { enabled: true }`.',
        },
        schema: [],
        messages: {
            omitted: 'Leaving out {{property}} stores this {{engine}} domain unencrypted. Turn encryption at rest on.',
            unencrypted: 'This {{engine}} domain is stored unencrypted. Turn encryption at rest on.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            NewExpression(node) {
                const domain = SEARCH_DOMAINS.get(getCdkName(source, node.callee));
                const isSpread = node.arguments.some(({ type }) => type === AST_NODE_TYPES.SpreadElement);
                if (domain === undefined || isSpread) return;
                const options = getCdkArgument(source, getCdkResult(source, node), CDK_PROPS_POSITION);
                const enabled = getCdkProperty(source, getCdkProperty(source, options, domain.encryption), 'enabled');
                const engine = detectEngine(source, getCdkProperty(source, options, domain.version), domain);
                const isOff =
                    enabled.status === 'found' &&
                    enabled.node.type === AST_NODE_TYPES.Literal &&
                    enabled.node.value === false;
                if (enabled.status === 'missing')
                    context.report({
                        node: enabled.node,
                        messageId: 'omitted',
                        data: { property: domain.encryption, engine },
                    });
                else if (isOff) context.report({ node: enabled.node, messageId: 'unencrypted', data: { engine } });
            },
        };
    },
});
