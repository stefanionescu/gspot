import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-public-instances', plugin.rules['aws-public-instances'], {
    valid: [
        "import * as ec2 from 'aws-cdk-lib/aws-ec2';\nnew ec2.Instance(this, 'Host', { vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } });",
    ],
    invalid: [
        {
            code: "import * as ec2 from 'aws-cdk-lib/aws-ec2';\nimport * as rds from 'aws-cdk-lib/aws-rds';\nimport * as dms from 'aws-cdk-lib/aws-dms';\nnew ec2.Instance(this, 'a', { vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC } });\nnew ec2.CfnInstance(this, 'b', { networkInterfaces: [{ associatePublicIpAddress: true }] });\nnew ec2.CfnInstance(this, 'c', { networkInterfaces: [{ associatePublicIpAddress: true, subnetId: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds[0] }] });\nnew rds.DatabaseInstance(this, 'd', { vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }, publiclyAccessible: true });\nnew rds.DatabaseInstance(this, 'e', { vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC } });\nnew rds.CfnDBInstance(this, 'f', { publiclyAccessible: true });\nnew dms.CfnReplicationInstance(this, 'g', {});\nnew dms.CfnReplicationInstance(this, 'h', { publiclyAccessible: false });\nnew rds.DatabaseInstance(this, 'i', { vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }, publiclyAccessible: undefined });",
            errors: [
                { messageId: 'publicNetwork', line: 4 },
                { messageId: 'publicNetwork', line: 5 },
                { messageId: 'publicNetwork', line: 7 },
                { messageId: 'publicNetwork', line: 8 },
                { messageId: 'publicNetwork', line: 9 },
                { messageId: 'publicNetwork', line: 10 },
                { messageId: 'publicNetwork', line: 12 },
            ],
        },
    ],
});
