import { awsUnblockedPublicBuckets } from '#eslint-plugin/rules/aws/aws-unblocked-public-buckets.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-unblocked-public-buckets', awsUnblockedPublicBuckets, {
    valid: [
        "import * as s3 from 'aws-cdk-lib/aws-s3';\nnew s3.Bucket(this, 'Data', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL });",
    ],
    invalid: [
        {
            code: "import * as s3 from 'aws-cdk-lib/aws-s3';\nnew s3.Bucket(this, 'a', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY });\nnew s3.Bucket(this, 'b', { blockPublicAccess: new s3.BlockPublicAccess({ blockPublicAcls: false, blockPublicPolicy: true, restrictPublicBuckets: false }) });\nnew s3.Bucket(this, 'c', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL });",
            errors: [
                { messageId: 'aclsOnly', line: 2 },
                { messageId: 'public', line: 3 },
                { messageId: 'public', line: 3 },
            ],
        },
    ],
});
