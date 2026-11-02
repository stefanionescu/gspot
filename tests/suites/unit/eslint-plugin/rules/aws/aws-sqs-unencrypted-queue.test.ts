import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-sqs-unencrypted-queue', plugin.rules['aws-sqs-unencrypted-queue'], {
    valid: [
        "import * as sqs from 'aws-cdk-lib/aws-sqs';\nnew sqs.Queue(this, 'Jobs', { encryption: sqs.QueueEncryption.KMS_MANAGED });",
    ],
    invalid: [
        {
            code: "import * as sqs from 'aws-cdk-lib/aws-sqs';\nnew sqs.Queue(this, 'a');\nnew sqs.Queue(this, 'b', { encryption: sqs.QueueEncryption.UNENCRYPTED });\nnew sqs.Queue(this, 'c', { encryption: sqs.QueueEncryption.KMS });\nnew sqs.CfnQueue(this, 'd', {});",
            errors: [
                { messageId: 'omitted', line: 2 },
                { messageId: 'invalid', line: 3 },
                { messageId: 'omitted', line: 5 },
            ],
        },
    ],
});
