import { EBS_VOLUME_CHECKS } from '../../config/aws.ts';
import { listCdkTableIssues } from '../../libraries/aws.ts';
import { createRule } from '../../rule.ts';

export const awsUnencryptedVolumes = createRule<[], 'omitted' | 'invalid'>({
    name: 'aws-unencrypted-volumes',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Finds `new ec2.Volume` constructions that leave out `encrypted` or set it to `false`.',
            why: 'An unencrypted volume exposes its data to anyone who gets a copy of the disk or of its snapshots.',
            fix: 'Set `encrypted: true` on the volume.',
            example:
                'The construction `new ec2.Volume(this, "Data", { availabilityZone, size })` reports `omitted`. Add `encrypted: true`.',
        },
        schema: [],
        messages: {
            omitted: 'Leaving out {{property}} stores this EBS volume unencrypted. Set {{property}} to true.',
            invalid: 'This EBS volume is stored unencrypted. Set {{property}} to true.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            NewExpression(node) {
                const issues = listCdkTableIssues(source, node, EBS_VOLUME_CHECKS);
                for (const { node: target, kind, property } of issues)
                    context.report({ node: target, messageId: kind, data: { property } });
            },
        };
    },
});
