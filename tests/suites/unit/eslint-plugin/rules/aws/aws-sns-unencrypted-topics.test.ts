import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-sns-unencrypted-topics', plugin.rules['aws-sns-unencrypted-topics'], {
    valid: ["import * as sns from 'aws-cdk-lib/aws-sns';\nnew sns.Topic(this, 'Alerts', { masterKey: key });"],
    invalid: [
        {
            code: "import * as sns from 'aws-cdk-lib/aws-sns';\nnew sns.Topic(this, 'a');\nnew sns.Topic(this, 'b', { masterKey: key });\nnew sns.CfnTopic(this, 'c', {});\nnew sns.Topic(this, 'd', { masterKey: undefined });",
            errors: [
                { messageId: 'omitted', line: 2 },
                { messageId: 'omitted', line: 4 },
                { messageId: 'omitted', line: 5 },
            ],
        },
    ],
});
