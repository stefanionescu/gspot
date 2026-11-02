import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-s3-bucket-versioning', plugin.rules['aws-s3-bucket-versioning'], {
    valid: [
        "import * as s3 from 'aws-cdk-lib/aws-s3';\nnew s3.Bucket(this, 'Records', { versioned: true });",
        'new Map();',
    ],
    invalid: [
        {
            code: "import { Bucket } from 'aws-cdk-lib/aws-s3';\nnew Bucket(this, 'a');\nconst v = false;\nnew Bucket(this, 'b', { versioned: v });\nnew Bucket(this, 'c', { versioned: true });",
            errors: [
                { messageId: 'omitted', line: 2 },
                { messageId: 'unversioned', line: 4 },
            ],
        },
    ],
});
