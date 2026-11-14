import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { awsSqsUnencryptedQueue } from '#eslint-plugin/rules/aws/aws-sqs-unencrypted-queue.ts';

buildRuleTester().run('aws-sqs-unencrypted-queue', awsSqsUnencryptedQueue, {
    valid: [
        "import * as sqs from 'aws-cdk-lib/aws-sqs';\nnew sqs.Queue(this, 'Jobs', { encryption: sqs.QueueEncryption.KMS_MANAGED });",
        "import * as sqs from 'aws-cdk-lib/aws-sqs';\nnew sqs.CfnQueue(this, 'd', { kmsMasterKeyId: key });",
    ],
    invalid: [
        {
            code: "import * as sqs from 'aws-cdk-lib/aws-sqs';\nnew sqs.Queue(this, 'a');\nnew sqs.Queue(this, 'b', { encryption: sqs.QueueEncryption.UNENCRYPTED });\nnew sqs.CfnQueue(this, 'd', {});",
            errors: [
                { messageId: 'omitted', data: { property: 'encryption' }, line: 2 },
                { messageId: 'invalid', data: { property: 'encryption' }, line: 3 },
                { messageId: 'omitted', data: { property: 'kmsMasterKeyId' }, line: 4 },
            ],
        },
    ],
});
