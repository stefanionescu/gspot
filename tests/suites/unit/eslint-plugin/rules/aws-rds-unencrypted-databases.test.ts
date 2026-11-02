import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-rds-unencrypted-databases', plugin.rules['aws-rds-unencrypted-databases'], {
    valid: [
        "import * as rds from 'aws-cdk-lib/aws-rds';\nnew rds.DatabaseInstance(this, 'Db', { engine, storageEncrypted: true });",
        "import * as rds from 'aws-cdk-lib/aws-rds';\nnew rds.DatabaseInstance(this, 'Db', ...options);",
    ],
    invalid: [
        {
            code: "import * as rds from 'aws-cdk-lib/aws-rds';\nimport * as kms from 'aws-cdk-lib/aws-kms';\nnew rds.DatabaseInstance(this, 'a', { engine });\nnew rds.DatabaseInstance(this, 'b', { storageEncrypted: false });\nnew rds.DatabaseInstance(this, 'c', { storageEncryptionKey: new kms.Key(this, 'k') });\nnew rds.CfnDBCluster(this, 'd');\nnew rds.DatabaseCluster(this, 'e', props);\nnew rds.CfnDBInstance(this, 'f', { storageEncrypted: true });",
            errors: [
                { messageId: 'omitted', line: 3, column: 37 },
                { messageId: 'unencrypted', line: 4, column: 57 },
                { messageId: 'omitted', line: 6, column: 5 },
            ],
        },
    ],
});
