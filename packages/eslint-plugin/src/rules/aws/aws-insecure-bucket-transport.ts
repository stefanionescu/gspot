import { findDisabledBucketOption } from '../../libraries/aws.ts';
import { createRule } from '../../rule.ts';

export const awsInsecureBucketTransport = createRule<[], 'omitted' | 'authorized'>({
    name: 'aws-insecure-bucket-transport',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Finds `new s3.Bucket` constructions that leave out `enforceSSL` or set it to `false`.',
            why: 'A bucket that accepts plain HTTP requests sends its objects and credentials in clear text over the network.',
            fix: 'Set `enforceSSL: true`, so that the bucket policy denies requests without TLS.',
            example:
                'The construction `new s3.Bucket(this, "Assets")` reports `omitted`. Use `new s3.Bucket(this, "Assets", { enforceSSL: true })`.',
        },
        schema: [],
        messages: {
            omitted: 'Leaving out enforceSSL lets this S3 bucket accept HTTP requests. Set enforceSSL to true.',
            authorized: 'This S3 bucket accepts HTTP requests. Set enforceSSL to true.',
        },
    },
    create(context) {
        return {
            NewExpression(node) {
                const issue = findDisabledBucketOption(context.sourceCode, node, 'enforceSSL');
                if (issue)
                    context.report({
                        node: issue.node,
                        messageId: issue.kind === 'omitted' ? 'omitted' : 'authorized',
                    });
            },
        };
    },
});
