// Select the rules for the selection and write them under the rules folder: the base rules, then each kit's own.
import { posix } from 'node:path';
import { similar } from '#cli/platform/text.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { detectConditions } from '#cli/kits/detect.ts';
import { readManifests } from '#cli/repository/packages.ts';
import { readAsset, listAssets } from '#cli/platform/assets.ts';
import type { Manifest, GeneratedFile } from '#cli/types/kits.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import { guideSections, selectedSections } from '#cli/rules/sections.ts';
import type { Level, RuleFile, RuleSource, RuleSettings } from '#cli/types/rules.ts';
import { TITLE, BASE_RULES, FIRST_READ, FRONT_MATTER, RULES_FOLDER } from '#cli/config/rules.ts';

// Whether an exclude entry names the file or a folder above it, both relative to the rules folder.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The selection and the exclude problems test an entry the same way; one owner keeps the folder rule.
function isExcluded(entry: string, path: string): boolean {
    return path === entry || path.startsWith(`${entry.replace(/\/$/u, '')}/`);
}

// The base rules every repository gets, in their three folders.
function baseRules(): RuleSource[] {
    return BASE_RULES.flatMap((layer) =>
        listAssets(`${RULES_FOLDER}/${layer}/`).map((source) => ({
            source,
            path: source.slice(RULES_FOLDER.length + 1),
            layer,
            kit: RULES_FOLDER,
        })),
    );
}

// The rules of the selected kits; a file with a condition installs only when the repository meets it.
function kitRules(manifests: Manifest[], repository: Repository): RuleSource[] {
    const conditions = manifests.flatMap((manifest) => Object.values(manifest.rules));
    const isRead = conditions.some((condition) => condition.dependencies.length > 0);
    const matched = detectConditions(
        conditions,
        repository.files,
        isRead ? readManifests(repository.root, repository.files) : [],
    );
    return manifests.flatMap((manifest) =>
        kitFiles(manifest).filter((file) => {
            const condition = manifest.rules[posix.basename(file.source)];
            return condition === undefined || matched.has(condition);
        }),
    );
}

// Whether a rule says anything at the level: a file whose every section is for level all is empty at recommended.
function isEmptyAt(source: string, level: Level): boolean {
    const text = readAsset(source);
    const kept = selectedSections(text, level);
    // The front matter parses as a heading, so it is left out of the count.
    const body = kept.replace(FRONT_MATTER, '');
    return kept !== text && !guideSections(body).some((section) => section.depth > 1);
}

/**
 * The files of a kit's rules folder. Each installs under the kit's category and name, as language/bash/BASH.md.
 * @param manifest the kit
 * @returns each file with its path inside the rules folder
 */
export function kitFiles(manifest: Manifest): RuleSource[] {
    const { kind, name } = manifest.kit;
    const sources = listAssets(`${manifest.dir}/${RULES_FOLDER}/`);
    for (const file of Object.keys(manifest.rules))
        if (!sources.includes(`${manifest.dir}/${RULES_FOLDER}/${file}`))
            throw new Error(`The rule ${file} of the ${name} kit does not exist.`);
    return sources.map((source) => ({
        source,
        path: `${kind}/${name}/${posix.basename(source)}`,
        layer: kind,
        kit: name,
    }));
}

/**
 * The rules the selection installs at the level: the base rules, then the files of each selected kit, without the
 * excluded ones and the ones the level leaves empty.
 * @param rules the rule policy
 * @param manifests the selected kits
 * @param repository the source inventory for the conditional rules.
 * @param level the selected enforcement level
 * @returns the rules with their targets and titles
 */
export function selectRuleFiles(
    rules: RuleSettings,
    manifests: Manifest[],
    repository: Repository,
    level: Level,
): RuleFile[] {
    const files = new Map<string, RuleFile>();
    for (const { source, path, layer, kit } of [...baseRules(), ...kitRules(manifests, repository)]) {
        if (files.has(path) || rules.exclude.some((entry) => isExcluded(entry, path))) continue;
        if (isEmptyAt(source, level)) continue;
        files.set(path, {
            source,
            target: `${rules.path}/${path}`,
            layer,
            kit,
            title: TITLE.exec(readAsset(source))?.groups?.['title'] ?? '',
        });
    }
    return files.values().toArray();
}

/**
 * The selected rules with sections filtered to the enforcement level.
 * @param rules the rule policy
 * @param manifests the selected kits
 * @param level the selected enforcement level.
 * @param repository the source inventory for the conditional rules.
 * @returns the files to write under the rules directory
 */
export function assembleRules(
    rules: RuleSettings,
    manifests: Manifest[],
    level: Level,
    repository: Repository,
): GeneratedFile[] {
    if (!rules.install) return [];
    return selectRuleFiles(rules, manifests, repository, level).map((file) => ({
        path: file.target,
        content: selectedSections(readAsset(file.source), level),
        readOnly: true,
        kind: 'rules',
        kit: file.kit,
    }));
}

/**
 * The problems of [rules] exclude: an entry that matches no rule, and an entry that hides a file the reader opens first.
 * @param exclude the entries as written, relative to the rules folder
 * @returns the problems in plain English
 */
export function excludeProblems(exclude: string[]): string[] {
    const paths = [...baseRules(), ...[...kitManifests().values()].flatMap((manifest) => kitFiles(manifest))].map(
        (file) => file.path,
    );
    return exclude.flatMap((entry) => {
        if (FIRST_READ.some((file) => isExcluded(entry, file)))
            return [
                `[rules] exclude names \`${entry}\`, which holds a file every agent opens first (${FIRST_READ.join(', ')}). Remove the entry.`,
            ];
        if (paths.some((path) => isExcluded(entry, path))) return [];
        const near = similar(entry, paths);
        const names = near.map((name) => `\`${name}\``).join(', ');
        const hint = near.length > 0 ? ` Did you mean ${names}?` : '';
        return [`[rules] exclude names \`${entry}\`, which matches no rule.${hint}`];
    });
}
