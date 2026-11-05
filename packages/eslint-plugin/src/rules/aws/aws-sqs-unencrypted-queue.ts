import { SQS_QUEUE_CHECKS } from '../../config/aws.ts';
import { listCdkTableIssues } from '../../libraries/aws.ts';
import { createRule } from '../../rule.ts';

export const awsSqsUnencryptedQueue = createRule<[], 'omitted' | 'invalid'>({
    name: 'aws-sqs-unencrypted-queue',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `new sqs.Queue` constructions that leave out `encryption` or set it to `QueueEncryption.UNENCRYPTED`, and `new sqs.CfnQueue` constructions without a `kmsMasterKeyId`.',
            why: 'An unencrypted queue stores its messages in clear text at rest.',
            fix: 'Set `encryption` to an encrypted mode, such as `QueueEncryption.KMS_MANAGED`, or set `kmsMasterKeyId`.',
            example:
                'The construction `new sqs.Queue(this, "Jobs")` reports `omitted`. Use `new sqs.Queue(this, "Jobs", { encryption: sqs.QueueEncryption.KMS_MANAGED })`.',
        },
        schema: [],
        messages: {
            omitted: 'Leaving out {{property}} stores the messages of this SQS queue unencrypted. Set {{property}}.',
            invalid: 'This SQS queue stores its messages unencrypted. Choose an encrypted {{property}}.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            NewExpression(node) {
                const issues = listCdkTableIssues(source, node, SQS_QUEUE_CHECKS);
                for (const { node: target, kind, property } of issues)
                    context.report({ node: target, messageId: kind, data: { property } });
            },
        };
    },
});
