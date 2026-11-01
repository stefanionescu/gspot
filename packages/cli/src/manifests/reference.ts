import { posix } from 'node:path';
import { listRuleFiles } from '#cli/manifests/read.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { ConfigurationReference } from '#cli/types/reference.ts';
import { DETECTION_LABELS, DETECTION_ALTERNATIVES } from '#cli/config/manifests/manifests.ts';

/**
Describe detection evidence and exclusions with the same vocabulary in help and documentation.

@param detect the manifest's selection or rule-file conditions.
*/
export function formatDetectionConditions(detect: Configuration['detect']): {
    conditions: string[];
    exclusions: string[];
} {
    const conditions: string[] = [];
    for (const [kind, patterns] of Object.entries(detect)) {
        if (kind === 'absent_dependencies') continue;
        if (!Array.isArray(patterns)) {
            conditions.push(
                ...Object.entries(patterns).map(([path, pattern]) => `file \`${path}\` matches \`${pattern}\``),
            );
            continue;
        }
        if (patterns.length === 0) continue;
        const names = DETECTION_ALTERNATIVES.format(patterns.map((name) => `\`${name}\``));
        conditions.push(`${DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS]} ${names}`);
    }
    const exclusions = detect.absent_dependencies.map((name) => `unless \`${name}\` is a dependency`);
    return { conditions, exclusions };
}

/**
Describe the shipped rules without applying repository-specific selection.

@param configuration the configuration that owns the rules.
*/
export function listRuleReferences(configuration: Configuration): ConfigurationReference['ruleFiles'] {
    const files = listRuleFiles(configuration);
    return files.map(({ path }) => {
        const condition = configuration.rules[posix.basename(path)];
        const detection =
            condition === undefined ? { conditions: [], exclusions: [] } : formatDetectionConditions(condition);
        return { path: posix.join(GSPOT_PATHS.configurations, path), ...detection };
    });
}
