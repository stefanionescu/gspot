import { awsS3BucketVersioning } from '#eslint-plugin/rules/aws/aws-s3-bucket-versioning.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-s3-bucket-versioning', awsS3BucketVersioning, {
    valid: [
        "import * as s3 from 'aws-cdk-lib/aws-s3';\nnew s3.Bucket(this, 'Records', { versioned: true });",
        'new Map();',
        "import * as s3 from 'aws-cdk-lib/aws-s3';\nconst kept = { versioned: true };\nnew s3.Bucket(this, 'a', { ...kept });",
        "import * as s3 from 'aws-cdk-lib/aws-s3';\nexport function make(scope, props) { return new s3.Bucket(scope, 'a', props); }",
    ],
    invalid: [
        {
            code: "import { Bucket } from 'aws-cdk-lib/aws-s3';\nnew Bucket(this, 'a');\nconst v = false;\nnew Bucket(this, 'b', { versioned: v });",
            errors: [
                { messageId: 'omitted', line: 2 },
                { messageId: 'unversioned', line: 4 },
            ],
        },
    ],
});
