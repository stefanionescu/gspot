import { awsInsecureBucketTransport } from '#eslint-plugin/rules/aws/aws-insecure-bucket-transport.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-insecure-bucket-transport', awsInsecureBucketTransport, {
    valid: ["import * as s3 from 'aws-cdk-lib/aws-s3';\nnew s3.Bucket(this, 'Assets', { enforceSSL: true });"],
    invalid: [
        {
            code: "import * as s3 from 'aws-cdk-lib/aws-s3';\nnew s3.Bucket(this, 'a');\nnew s3.Bucket(this, 'b', { enforceSSL: false });\nconst { Bucket } = require('aws-cdk-lib/aws-s3');\nnew Bucket(this, 'd', {});",
            errors: [
                { messageId: 'omitted', line: 2 },
                { messageId: 'authorized', line: 3 },
                { messageId: 'omitted', line: 5 },
            ],
        },
    ],
});
