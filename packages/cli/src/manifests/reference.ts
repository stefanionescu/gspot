import { posix } from 'node:path';
import { formatNameList } from '#cli/system/text.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { listRuleFiles } from '#cli/manifests/read.ts';
import type { Configuration, ConfigurationReference } from '#cli/types/manifests.ts';

const DETECTION_LABELS = {
    extensions: ['a file extension', 'file extensions'],
    filenames: ['a filename', 'filenames'],
    dependencies: ['a dependency', 'dependencies'],
    runtimes: ['a JavaScript runtime', 'JavaScript runtimes'],
    tags: ['a file with a shebang for', 'files with a shebang for'],
    paths: ['a file path', 'file paths'],
    project_files: ['a project file', 'project files'],
} as const;
const SHEBANG_TAG = 'shebang:';
const NEGATED_PATTERN = '!';

function formatListCondition(kind: keyof typeof DETECTION_LABELS, patterns: readonly string[]): string | undefined {
    const names = patterns
        .filter((name) => !name.startsWith(NEGATED_PATTERN))
        .map((name) => (name.startsWith(SHEBANG_TAG) ? name.slice(SHEBANG_TAG.length) : name));
    if (names.length === 0) return undefined;
    const excepted = patterns.filter((name) => name.startsWith(NEGATED_PATTERN)).map((name) => name.slice(1));
    const [one, many] = DETECTION_LABELS[kind];
    const listed = formatNameList(
        names.map((name) => `\`${name}\``),
        'disjunction',
    );
    const except =
        excepted.length === 0
            ? ''
            : ', except ' +
              formatNameList(
                  excepted.map((name) => `\`${name}\``),
                  'disjunction',
              );
    return `${names.length === 1 ? one : many} ${listed}${except}`;
}

/**
Describe detection evidence and exclusions with the same vocabulary in help and documentation. A negated path pattern
and the absent dependencies read as exceptions, not as evidence.

@param detect the manifest's selection or rule-file conditions.
*/
export function formatDetectionConditions(detect: Configuration['detect']): {
    conditions: string[];
    exclusions: string[];
} {
    const conditions = Object.entries(detect).flatMap(([kind, patterns]) => {
        if (kind === 'absent_dependencies') return [];
        if (Array.isArray(patterns)) {
            const condition = formatListCondition(kind as keyof typeof DETECTION_LABELS, patterns);
            return condition === undefined ? [] : [condition];
        }
        return Object.entries(patterns).map(
            ([path, pattern]) => `a file \`${path}\` whose text matches the regular expression \`${pattern}\``,
        );
    });
    const dependencies = formatNameList(
        detect.absent_dependencies.map((name) => `\`${name}\``),
        'disjunction',
    );
    const exclusions = detect.absent_dependencies.length === 0 ? [] : [`unless the scope depends on ${dependencies}`];
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
