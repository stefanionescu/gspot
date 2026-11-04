import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noClearTextProtocols } from '#eslint-plugin/rules/networks/no-clear-text-protocols.ts';

buildRuleTester().run('no-clear-text-protocols', noClearTextProtocols, {
    valid: [
        // eslint-disable-next-line unicorn/prefer-https -- reason: these clear-text URLs check the hosts that the rule under test exempts.
        "const api = 'https://api.acme.io';\nconst local = 'http://localhost:8080';\nconst sample = 'http://www.example.com';\nconst svg = 'http://www.w3.org/2000/svg';",
        "const nodemailer = require('nodemailer');\nnodemailer.createTransport({ secure: useTls });",
        "const nodemailer = require('nodemailer');\nnodemailer.createTransport({ SES: { ses, aws } });",
        "const nodemailer = require('nodemailer');\nnodemailer.createTransport(buildOptions());",
        "const url = new URL(path, 'http://base');",
        "import nodemailer from 'nodemailer'; nodemailer.createTransport({ service: 'gmail', auth });",
    ],
    invalid: [
        {
            // eslint-disable-next-line unicorn/prefer-https -- reason: the rule under test reports these clear-text URLs.
            code: "const a = 'http://api.acme.io';\nconst b = 'https://api.acme.io';\nconst c = 'http://localhost:3000';\nconst d = 'http://www.example.com/x';\nconst e = 'ftp://files.acme.io';\nconst f = 'http://' + host;\nconst g = 'http://';\nconst h = 'http://www.w3.org/2000/svg';\nconst i = 'ws://chat.acme.io';\nconst j = 'http://169.254.169.254/latest';\nconst k = 'http://jabber.org/protocol/x';\nconst l = 'http://jabber.org/http-bind';\nconst m = `http://${host}`;\nconst n = 'smtp://mail';\nimport Telnet from 'telnet-client';\nconst nodemailer = require('nodemailer');\nnodemailer.createTransport({ host: 'h' });\nnodemailer.createTransport({ host: 'h', secure: true });\nnodemailer.createTransport({ port: 465 });\nconst Client = require('ftp');\nconst ftp = new Client();\nftp.connect({ secure: false });\nrequire('telnet-client');\nconst o = 'http://localhost:${port}/x';",
            errors: [
                { messageId: 'clearText', line: 1 },
                { messageId: 'clearText', line: 5 },
                { messageId: 'clearText', line: 6 },
                { messageId: 'clearText', line: 9 },
                { messageId: 'clearText', line: 12 },
                { messageId: 'clearText', line: 14 },
                { messageId: 'clearText', line: 15 },
                { messageId: 'clearText', line: 17 },
                { messageId: 'clearText', line: 22 },
                { messageId: 'clearText', line: 23 },
            ],
        },
        {
            code: "import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';\nimport * as elb from 'aws-cdk-lib/aws-elasticloadbalancing';\nimport * as kinesis from 'aws-cdk-lib/aws-kinesis';\nimport * as elasticache from 'aws-cdk-lib/aws-elasticache';\nconst alb = new elbv2.ApplicationLoadBalancer(this, 'a', { vpc });\nalb.addListener('l', { port: 80 });\nalb.addListener('m', { protocol: elbv2.ApplicationProtocol.HTTP });\nalb.addListener('n', { protocol: elbv2.ApplicationProtocol.HTTPS });\nnew elbv2.ApplicationListener(this, 'o', { loadBalancer: alb, port: 8080 });\nconst nlb = new elbv2.NetworkLoadBalancer(this, 'p', { vpc });\nnlb.addListener('q', { port: 443 });\nnlb.addListener('r', { port: 443, certificates: [cert] });\nnew kinesis.Stream(this, 's', { encryption: kinesis.StreamEncryption.UNENCRYPTED });\nnew kinesis.CfnStream(this, 't', {});\nnew elasticache.CfnReplicationGroup(this, 'u', { transitEncryptionEnabled: false });\nnew elb.LoadBalancer(this, 'v', { listeners: [{ externalProtocol: elb.LoadBalancingProtocol.HTTP }] });\nnew elb.CfnLoadBalancer(this, 'w', { listeners: [{ protocol: 'http' }] });\nnew elbv2.CfnListener(this, 'x', { protocol: 'TCP' });",
            errors: [
                { messageId: 'noTls', line: 6 },
                { messageId: 'noTls', line: 7 },
                { messageId: 'noTls', line: 9 },
                { messageId: 'noTls', line: 11 },
                { messageId: 'streamEncryption', line: 13 },
                { messageId: 'streamEncryption', line: 14 },
                { messageId: 'transitEncryption', line: 15 },
                { messageId: 'noTls', line: 16 },
                { messageId: 'noTls', line: 17 },
                { messageId: 'noTls', line: 18 },
            ],
        },
        {
            code: "import * as elb from 'aws-cdk-lib/aws-elasticloadbalancing';\nconst balancer = new elb.LoadBalancer(this, 'a', {});\nbalancer.addListener({ externalProtocol: elb.LoadBalancingProtocol.HTTP });",
            errors: [{ messageId: 'noTls', line: 3 }],
        },
    ],
});
