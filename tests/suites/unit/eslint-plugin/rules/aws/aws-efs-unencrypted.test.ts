import { awsEfsUnencrypted } from '#eslint-plugin/rules/aws/aws-efs-unencrypted.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-efs-unencrypted', awsEfsUnencrypted, {
    valid: [
        "import * as efs from 'aws-cdk-lib/aws-efs';\nnew efs.FileSystem(this, 'Files', { vpc });",
        "import * as efs from 'aws-cdk-lib/aws-efs';\nnew efs.FileSystem(this, 'Files');",
    ],
    invalid: [
        {
            code: "import * as efs from 'aws-cdk-lib/aws-efs';\nnew efs.FileSystem(this, 'b', { encrypted: false });\nnew efs.CfnFileSystem(this, 'c', {});\nnew efs.CfnFileSystem(this, 'd', { encrypted: false });\nnew efs.CfnFileSystem(this, 'e', { encrypted: true });",
            errors: [
                { messageId: 'invalid', line: 2 },
                { messageId: 'omitted', line: 3 },
                { messageId: 'invalid', line: 4 },
            ],
        },
    ],
});
