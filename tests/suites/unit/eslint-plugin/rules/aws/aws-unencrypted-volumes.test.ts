import { awsUnencryptedVolumes } from '#eslint-plugin/rules/aws/aws-unencrypted-volumes.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-unencrypted-volumes', awsUnencryptedVolumes, {
    valid: [
        "import * as ec2 from 'aws-cdk-lib/aws-ec2';\nnew ec2.Volume(this, 'Data', { encrypted: true });",
        "import * as ec2 from 'aws-cdk-lib/aws-ec2';\nnew ec2.Volume(this, 'Data', buildOptions());",
    ],
    invalid: [
        {
            code: "import * as ec2 from 'aws-cdk-lib/aws-ec2';\nnew ec2.Volume(this, 'a', { size });\nnew ec2.Volume(this, 'b', { encrypted: false });\nnew ec2.Volume(this, 'd');\nconst o = { size };\nnew ec2.Volume(this, 'f', o);\nconst p = { encrypted: false };\nnew ec2.Volume(this, 'g', p);",
            errors: [
                { messageId: 'omitted', line: 2, column: 27 },
                { messageId: 'invalid', line: 3, column: 40 },
                { messageId: 'omitted', line: 4, column: 5 },
                { messageId: 'omitted', line: 6, column: 27 },
                { messageId: 'invalid', line: 8, column: 27 },
            ],
        },
    ],
});
