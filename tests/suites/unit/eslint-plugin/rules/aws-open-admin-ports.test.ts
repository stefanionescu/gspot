import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-open-admin-ports', plugin.rules['aws-open-admin-ports'], {
    valid: [
        "import * as ec2 from 'aws-cdk-lib/aws-ec2';\nconst group = new ec2.SecurityGroup(this, 'Group', { vpc });\ngroup.addIngressRule(ec2.Peer.ipv4('203.0.113.0/24'), ec2.Port.tcp(22));\ngroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));",
    ],
    invalid: [
        {
            code: "import * as ec2 from 'aws-cdk-lib/aws-ec2';\nconst group = new ec2.SecurityGroup(this, 'g', { vpc });\ngroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));\ngroup.addIngressRule(ec2.Peer.ipv4('10.0.0.0/8'), ec2.Port.tcp(22));\ngroup.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcpRange(20, 30));\ngroup.connections.allowFrom(ec2.Peer.ipv4('0.0.0.0/0'), ec2.Port.allTraffic());\ngroup.connections.allowFromAnyIpv4(ec2.Port.tcp(3389));\nnew ec2.CfnSecurityGroup(this, 's', { securityGroupIngress: [{ cidrIp: '0.0.0.0/0', ipProtocol: 'tcp', fromPort: 22, toPort: 22 }] });\nnew ec2.CfnSecurityGroupIngress(this, 'i', { cidrIpv6: '::/0', ipProtocol: '-1' });\nconst conns = new ec2.Connections({ defaultPort: ec2.Port.tcp(22) });\nconns.allowDefaultPortFromAnyIpv4();\ngroup.addIngressRule(ec2.Peer.anyIpv4(), new ec2.Port({ protocol: ec2.Protocol.TCP, fromPort: 20, toPort: 25 }));",
            errors: [
                { messageId: 'openRange', line: 3 },
                { messageId: 'openRange', line: 5 },
                { messageId: 'openRange', line: 6 },
                { messageId: 'anyAddress', line: 7 },
                { messageId: 'openRange', line: 8 },
                { messageId: 'openRange', line: 9 },
                { messageId: 'anyAddress', line: 11 },
                { messageId: 'openRange', line: 12 },
            ],
        },
    ],
});
