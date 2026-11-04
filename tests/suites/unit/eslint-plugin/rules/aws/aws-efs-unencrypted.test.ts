import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { awsEfsUnencrypted } from '#eslint-plugin/rules/aws/aws-efs-unencrypted.ts';

buildRuleTester().run('aws-efs-unencrypted', awsEfsUnencrypted, {
    valid: [
        "import * as efs from 'aws-cdk-lib/aws-efs';\nnew efs.FileSystem(this, 'Files', { vpc });",
        "import * as efs from 'aws-cdk-lib/aws-efs';\nnew efs.FileSystem(this, 'Files');",
    ],
    invalid: [
        {
            code: "import * as efs from 'aws-cdk-lib/aws-efs';\nnew efs.FileSystem(this, 'a', { vpc });\nnew efs.FileSystem(this, 'b', { encrypted: false });\nnew efs.CfnFileSystem(this, 'c', {});\nnew efs.CfnFileSystem(this, 'd', { encrypted: false });\nnew efs.CfnFileSystem(this, 'e', { encrypted: true });",
            errors: [
                { messageId: 'invalid', line: 3 },
                { messageId: 'omitted', line: 4 },
                { messageId: 'invalid', line: 5 },
            ],
        },
    ],
});
