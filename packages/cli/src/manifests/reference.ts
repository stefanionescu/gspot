import { posix } from 'node:path';
import { formatNameList } from '#cli/system/text.ts';
import { listRuleFiles } from '#cli/manifests/read.ts';
import { GSPOT_PATHS, DETECTION_LABELS } from '#cli/config/manifests.ts';
import type { Configuration, ConfigurationReference } from '#cli/types/manifests.ts';

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
        const names = formatNameList(
            patterns.map((name) => `\`${name}\``),
            'disjunction',
        );
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
        const condition = configuration.rules[path];
        const detection =
            condition === undefined ? { conditions: [], exclusions: [] } : formatDetectionConditions(condition);
        return { path: posix.join(GSPOT_PATHS.rules, path), ...detection };
    });
}
