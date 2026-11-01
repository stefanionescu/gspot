import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-efs-unencrypted', plugin.rules['aws-efs-unencrypted'], {
    valid: ["import * as efs from 'aws-cdk-lib/aws-efs';\nnew efs.FileSystem(this, 'Files', { vpc });"],
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
