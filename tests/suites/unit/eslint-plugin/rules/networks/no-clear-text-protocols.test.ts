import { noClearTextProtocols } from '#eslint-plugin/rules/networks/no-clear-text-protocols.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-clear-text-protocols', noClearTextProtocols, {
    valid: [
        "const api = 'https://api.acme.io';\nconst local = 'http://localhost:8080';\nconst svg = 'http://www.w3.org/2000/svg';",
        "const nodemailer = require('nodemailer');\nnodemailer.createTransport({ secure: useTls });",
        "const nodemailer = require('nodemailer');\nnodemailer.createTransport(buildOptions());",
        "const url = new URL(path, 'http://base');",
        "import nodemailer from 'nodemailer'; nodemailer.createTransport({ service: 'gmail', auth });",
    ],
    invalid: [
        {
            // eslint-disable-next-line unicorn/prefer-https -- reason: the rule under test reports these clear-text URLs.
            code: "const a = 'http://api.acme.io';\nconst f = 'http://' + host;\nconst g = 'http://';\nconst k = 'http://jabber.org/protocol/x';\nconst l = 'http://jabber.org/http-bind';\nimport Telnet from 'telnet-client';\nconst nodemailer = require('nodemailer');\nnodemailer.createTransport({ host: 'h' });\nnodemailer.createTransport({ port: 465 });\nconst Client = require('ftp');\nconst ftp = new Client();\nftp.connect({ secure: false });\nrequire('telnet-client');\nconst o = 'http://localhost:${port}/x';",
            errors: [
                { messageId: 'clearText', data: { protocol: 'http', alternative: 'https' }, line: 1 },
                { messageId: 'clearText', data: { protocol: 'http', alternative: 'https' }, line: 2 },
                { messageId: 'clearText', data: { protocol: 'http', alternative: 'https' }, line: 5 },
                { messageId: 'clearText', data: { protocol: 'telnet', alternative: 'ssh' }, line: 6 },
                { messageId: 'clearText', data: { protocol: 'http', alternative: 'https' }, line: 8 },
                { messageId: 'clearText', data: { protocol: 'ftp', alternative: 'sftp, scp, or ftps' }, line: 12 },
                { messageId: 'clearText', data: { protocol: 'telnet', alternative: 'ssh' }, line: 13 },
            ],
        },
        {
            code: "import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';\nimport * as elb from 'aws-cdk-lib/aws-elasticloadbalancing';\nimport * as kinesis from 'aws-cdk-lib/aws-kinesis';\nimport * as elasticache from 'aws-cdk-lib/aws-elasticache';\nconst alb = new elbv2.ApplicationLoadBalancer(this, 'a', { vpc });\nalb.addListener('l', { port: 80 });\nalb.addListener('m', { protocol: elbv2.ApplicationProtocol.HTTP });\nalb.addListener('n', { protocol: elbv2.ApplicationProtocol.HTTPS });\nnew elbv2.ApplicationListener(this, 'o', { loadBalancer: alb, port: 8080 });\nconst nlb = new elbv2.NetworkLoadBalancer(this, 'p', { vpc });\nnlb.addListener('q', { port: 443 });\nnlb.addListener('r', { port: 443, certificates: [cert] });\nnew kinesis.Stream(this, 's', { encryption: kinesis.StreamEncryption.UNENCRYPTED });\nnew elasticache.CfnReplicationGroup(this, 'u', { transitEncryptionEnabled: false });\nnew elb.LoadBalancer(this, 'v', { listeners: [{ externalProtocol: elb.LoadBalancingProtocol.HTTP }] });",
            errors: [
                { messageId: 'noTls', line: 6 },
                { messageId: 'noTls', line: 7 },
                { messageId: 'noTls', line: 9 },
                { messageId: 'noTls', line: 11 },
                { messageId: 'streamEncryption', line: 13 },
                { messageId: 'transitEncryption', line: 14 },
                { messageId: 'noTls', line: 15 },
            ],
        },
        {
            code: "import * as elb from 'aws-cdk-lib/aws-elasticloadbalancing';\nconst balancer = new elb.LoadBalancer(this, 'a', {});\nbalancer.addListener({ externalProtocol: elb.LoadBalancingProtocol.HTTP });",
            errors: [{ messageId: 'noTls', line: 3 }],
        },
    ],
});
