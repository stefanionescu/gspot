import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-public-bucket-grants', plugin.rules['aws-public-bucket-grants'], {
    valid: [
        "import * as s3 from 'aws-cdk-lib/aws-s3';\nnew s3.Bucket(this, 'Data', { accessControl: s3.BucketAccessControl.PRIVATE });",
    ],
    invalid: [
        {
            code: "import * as s3 from 'aws-cdk-lib/aws-s3';\nimport * as deploy from 'aws-cdk-lib/aws-s3-deployment';\nnew s3.Bucket(this, 'a', { accessControl: s3.BucketAccessControl.PUBLIC_READ });\nnew s3.Bucket(this, 'b', { publicReadAccess: true });\nconst bucket = new s3.Bucket(this, 'c');\nbucket.grantPublicAccess();\nnew deploy.BucketDeployment(this, 'd', { accessControl: s3.BucketAccessControl.AUTHENTICATED_READ });\nnew s3.Bucket(this, 'e', { accessControl: s3.BucketAccessControl.PRIVATE });",
            errors: [
                { messageId: 'accessLevel', line: 3 },
                { messageId: 'unrestricted', line: 4 },
                { messageId: 'unrestricted', line: 6 },
                { messageId: 'accessLevel', line: 7 },
            ],
        },
    ],
});
