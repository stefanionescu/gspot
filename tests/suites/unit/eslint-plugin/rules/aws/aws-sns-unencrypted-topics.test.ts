import { awsSnsUnencryptedTopics } from '#eslint-plugin/rules/aws/aws-sns-unencrypted-topics.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-sns-unencrypted-topics', awsSnsUnencryptedTopics, {
    valid: ["import * as sns from 'aws-cdk-lib/aws-sns';\nnew sns.Topic(this, 'Alerts', { masterKey: key });"],
    invalid: [
        {
            code: "import * as sns from 'aws-cdk-lib/aws-sns';\nnew sns.CfnTopic(this, 'c', {});\nnew sns.Topic(this, 'd', { masterKey: undefined });",
            errors: [
                { messageId: 'omitted', data: { property: 'kmsMasterKeyId' }, line: 2 },
                { messageId: 'omitted', data: { property: 'masterKey' }, line: 3 },
            ],
        },
    ],
});
