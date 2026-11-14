import { createRule } from '../../rule.ts';
import { SNS_TOPIC_CHECKS } from '../../config/aws.ts';
import { listCdkTableIssues } from '../../libraries/aws.ts';

export const awsSnsUnencryptedTopics = createRule<[], 'omitted'>({
    name: 'aws-sns-unencrypted-topics',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `new sns.Topic` constructions without a `masterKey` and `new sns.CfnTopic` constructions without a `kmsMasterKeyId`.',
            why: 'Without a key, the messages of the topic are not encrypted at rest with a key that you control.',
            fix: 'Set `masterKey` or `kmsMasterKeyId` to a KMS key.',
            example:
                'The construction `new sns.Topic(this, "Alerts")` reports `omitted`. Use `new sns.Topic(this, "Alerts", { masterKey: key })`.',
        },
        schema: [],
        messages: {
            omitted: 'Leaving out {{property}} stores the messages of this SNS topic unencrypted. Set {{property}}.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            NewExpression(node) {
                const issues = listCdkTableIssues(source, node, SNS_TOPIC_CHECKS);
                for (const { node: target, property } of issues)
                    context.report({ node: target, messageId: 'omitted', data: { property } });
            },
        };
    },
});
