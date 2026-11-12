import { posix } from 'node:path';

import { GSPOT_PATHS, SHEBANG_TAG } from '#cli/config/manifests.ts';
import { SWIFT_IMPORT_TAG, SWIFT_TEST_TAG, SWIFT_TEST_TARGET_TAG } from '#cli/config/parsers/code.ts';
import { GLOB_EXCLUDE } from '#cli/config/system.ts';
import { listRuleFiles } from '#cli/manifests/read.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { Configuration, ConfigurationReference } from '#cli/types/manifests.ts';

const DETECTION_LABELS = {
    extensions: ['a file extension', 'file extensions'],
    filenames: ['a filename', 'filenames'],
    dependencies: ['a dependency on', 'a dependency on'],
    runtimes: ['a JavaScript runtime', 'JavaScript runtimes'],
    tags: ['a file with a shebang for', 'files with a shebang for'],
    paths: ['a file path', 'file paths'],
    project_files: ['a project file', 'project files'],
} as const;

function formatListCondition(kind: keyof typeof DETECTION_LABELS, patterns: readonly string[]): string | undefined {
    const names = patterns
        .filter((name) => !name.startsWith(GLOB_EXCLUDE))
        .map((name) => (name.startsWith(SHEBANG_TAG) ? name.slice(SHEBANG_TAG.length) : name));
    if (names.length === 0) return undefined;
    const excepted = patterns.filter((name) => name.startsWith(GLOB_EXCLUDE)).map((name) => name.slice(1));
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

function formatSwiftTag(tag: string): string {
    if (tag === SWIFT_TEST_TAG) return 'a Swift test file';
    if (tag === SWIFT_TEST_TARGET_TAG) return 'a `Package.swift` with a test target';
    return `a Swift file that imports \`${tag.slice(SWIFT_IMPORT_TAG.length)}\``;
}

function formatTagConditions(tags: readonly string[]): string[] {
    const shebangs = formatListCondition(
        'tags',
        tags.filter((tag) => tag.startsWith(SHEBANG_TAG)),
    );
    const others = tags.filter((tag) => !tag.startsWith(SHEBANG_TAG)).map((tag) => formatSwiftTag(tag));
    return [...(shebangs === undefined ? [] : [shebangs]), ...others];
}

/**
Describe detection evidence and exclusions with the same vocabulary in help and documentation. A negated path pattern
and the absent dependencies read as exceptions, not as evidence.
*/
export function formatDetectionConditions(detect: Configuration['detect']): {
    conditions: string[];
    exclusions: string[];
} {
    const conditions = Object.entries(detect).flatMap(([kind, patterns]) => {
        if (kind === 'absent_dependencies') return [];
        if (kind === 'tags') return formatTagConditions(detect.tags);
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

export function listRuleReferences(configuration: Configuration): ConfigurationReference['ruleFiles'] {
    const files = listRuleFiles(configuration);
    return files.map(({ path }) => {
        const condition = configuration.rules[path];
        const detection =
            condition === undefined ? { conditions: [], exclusions: [] } : formatDetectionConditions(condition);
        return { path: posix.join(GSPOT_PATHS.rules, path), ...detection };
    });
}
