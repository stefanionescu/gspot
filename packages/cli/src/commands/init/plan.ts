import { formatCount } from '#cli/system/text.ts';
import { getColors } from '#cli/system/terminal.ts';
import { stripUndefined } from '#cli/system/values.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { GROUP_LABELS } from '#cli/config/configurations.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { listSubmodulePaths } from '#cli/repository/tracked.ts';
import { readLintJobs } from '#cli/repository/existing-tools.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/tracked.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import type { PackageJson } from '#cli/types/parsers/dependency-files.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';

import {
    type InitPlan,
    type InitAnswers,
    type InitFileRow,
    type InitPlanInputs,
    type DetectionSummary,
} from '#cli/types/commands/init.ts';
import {
    DOT_GSPOT,
    SETTINGS_FILE,
    NPM_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';
import {
    HOOKS_ROW,
    COLUMN_GAP,
    REASON_WIDTH,
    CI_FILE_NOTES,
    ATTRIBUTES_ROW,
    CONFIGURATION_WIDTH,
    DETECTION_GAP_WIDTH,
    DETECTION_LABEL_WIDTH,
} from '#cli/config/commands/init.ts';

function buildToolProjectRows(everySelected: Manifest[], reads: ReadCache): InitPlan['change'] {
    const pins = listToolProjectPins(everySelected);
    const count = Object.keys(pins.npm).length;
    const rows: InitPlan['change'] =
        count === 0
            ? []
            : [{ path: NPM_TOOL_PROJECT_FILE, note: `${formatCount(count, 'pinned npm tool')}; matching lockfile` }];
    const python = pins.python.length;
    if (python > 0)
        rows.push({
            path: PYTHON_TOOL_PROJECT_FILE,
            note: `${formatCount(python, 'pinned Python tool')}; matching uv.lock and tool environment`,
        });
    const mise = listMisePins(everySelected, reads).length;
    if (mise > 0) rows.unshift({ path: MISE_TOOL_PROJECT_FILE, note: formatCount(mise, 'tool pin') });
    return rows;
}

// Name the dependencies that the generated tool project pins. Keep the authored dependency file.
function buildPinnedDependencyRows({ root, existingTools }: InitPlanInputs, requirements: Manifest[]): InitFileRow[] {
    const pinned = new Set(Object.keys(listToolProjectPins(requirements).npm));
    return existingTools.toolOnlyPackages.flatMap((path) => {
        const packageJson = readPackageJson(root, path) as PackageJson;
        const names = [
            ...new Set(
                Object.keys({
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies,
                    ...packageJson.peerDependencies,
                    ...packageJson.optionalDependencies,
                }),
            ),
        ]
            .filter((name) => pinned.has(name))
            .toSorted((left, right) => left.localeCompare(right));
        if (names.length === 0) return [];
        const subject = names.join(', ');
        const verb = names.length === 1 ? 'is' : 'are';
        const pronoun = names.length === 1 ? 'it' : 'them';
        return [
            {
                path,
                note: `${subject} ${verb} now pinned in ${NPM_TOOL_PROJECT_FILE}; remove ${pronoun} from devDependencies if nothing else uses ${pronoun}`,
            },
        ];
    });
}

// List the CI files that init leaves alone: all of them when init writes no workflow, and every existing lint job.
function buildKeptCiRows(ci: InitAnswers['ci'], ciFiles: string[], lintJobs: string[]): InitPlan['retained'] {
    const untouched =
        ci === 'none' && lintJobs.length === 0
            ? ciFiles.map((path) => ({
                  path,
                  note: 'existing CI file',
              }))
            : [];
    const jobs = lintJobs.map((path) => ({ path, note: 'existing lint job kept. gspot adds no second CI job.' }));
    return [...untouched, ...jobs];
}

function formatFileSection(title: string, rows: InitFileRow[]): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.path.length)) + COLUMN_GAP;
    return [title, ...rows.map((row) => `  ${row.path.padEnd(width)}${row.note}`), ''];
}

function buildConfigurationRows(
    { everySelected, selection }: InitPlanInputs,
    { level }: Settings,
): InitPlan['configurations'] {
    return everySelected.map((manifest) => {
        const checks = manifest.checks.filter((check) => level === 'all' || check.level === 'recommended').length;
        return {
            configuration: manifest.configuration.name,
            how: selection.how.get(manifest.configuration.name) ?? 'required',
            checks,
            checksOff: manifest.checks.length - checks,
        };
    });
}

function formatConfigurationSection(rows: InitPlan['configurations'], level: InitPlan['level']): string[] {
    if (rows.length === 0) return ['configurations', '  none', ''];
    const lines = rows.map((row) => {
        return `  ${row.configuration.padEnd(CONFIGURATION_WIDTH)} ${row.how.padEnd(REASON_WIDTH)} ${formatCount(row.checks, 'check')} (${String(row.checksOff)} off at ${level})`;
    });
    return ['configurations', ...lines, ''];
}

function formatTemplateSection(template: InitPlan['template']): string[] {
    if (!template) return [];
    const detected = template.detected.map(
        (id) => `  detected, not in the template: ${id}  (add it afterwards: gspot add ${id})`,
    );
    return [`template    ${template.source}  sha256 ${template.digest}`, ...detected, ''];
}

/**
 * Build the file writes and integrations that init shows before it asks you to accept.
 * @param planning the repository facts, answers, and configurations.
 * @param settings the validated gspot.toml and its generated files.
 * @param settings.settings the parsed gspot.toml for file generation.
 * @param settings.settingsText the proposed gspot.toml text.
 * @param settings.requirements the configurations to install.
 * @param settings.generated the files to write and their ownership plan.
 * @returns the plan that init proposes.
 */
function buildInitPlan(
    planning: InitPlanInputs,
    {
        settings,
        settingsText,
        requirements,
        generated,
    }: { settings: Settings; settingsText: string; requirements: Manifest[]; generated: GenerationResult },
): InitPlan {
    const { root, hasGit, existingTools, selection, answers, replaced, options } = planning;
    const template = options.template && {
        source: options.template.source,
        digest: options.template.digest,
        detected: selection.detected
            .map((evidence) => evidence.configuration)
            .filter((id) => !selection.selectedIds.has(id)),
    };
    const change = [ATTRIBUTES_ROW, ...buildToolProjectRows(requirements, planning.reads)];
    if (hasGit) {
        change.unshift({ path: GITIGNORE_FILE, note: 'one managed block' });
        if (answers.hooks) change.push(HOOKS_ROW);
    }
    return {
        ...stripUndefined({ template }),
        level: settings.level,
        configurations: buildConfigurationRows(planning, settings),
        write: [
            { path: SETTINGS_FILE, note: `your settings, ${String(settingsText.split('\n').length)} lines` },
            { path: `${DOT_GSPOT}/`, note: 'generated files and version pin' },
            ...[...generated.files, ...generated.blocks]
                .filter(({ path }) => !isInGspotFolder(path) && !change.some((row) => row.path === path))
                .map(({ path }) => ({
                    path,
                    note: Object.hasOwn(CI_FILE_NOTES, path)
                        ? CI_FILE_NOTES[path as keyof typeof CI_FILE_NOTES]
                        : 'generated file',
                })),
        ],
        delete: replaced.deleted,
        retained: [
            ...replaced.retained,
            ...listSubmodulePaths(planning.index).map((path) => ({ path, note: 'submodule; contents are not read' })),
            ...buildKeptCiRows(answers.ci, existingTools.ci, readLintJobs(root, existingTools.ci)),
        ],
        change: [...change, ...replaced.changed, ...buildPinnedDependencyRows(planning, requirements)],
        noLongerRuns: existingTools.lintFolders.map((folder) => ({
            path: `${folder}/`,
            note: 'a folder of lint scripts; check remaining references before deleting it',
        })),
    };
}

/**
 * Format the plan that init prints before it writes anything.
 * @param plan the configurations and file changes to preview.
 * @returns the text.
 */
function formatInitPlan(plan: InitPlan): string {
    const { dim } = getColors();
    const lines = [
        ...formatTemplateSection(plan.template),
        ...formatConfigurationSection(plan.configurations, plan.level),
        ...formatFileSection('write', plan.write),
        ...formatFileSection(
            `delete ${dim('(your own rules in them do not carry over; read them with git show HEAD:<path>)')}`,
            plan.delete,
        ),
        ...formatFileSection('left in place', plan.retained),
        ...formatFileSection('change', plan.change),
        ...formatFileSection('no longer runs; delete when ready', plan.noLongerRuns),
        'Change these later with gspot set hooks.enabled, ci.enabled, ci.provider, or rules.enabled.',
    ];
    return `${lines.join('\n')}\n`;
}

function formatDetectionRow(label: string, items: string[]): string | undefined {
    return items.length === 0
        ? undefined
        : `${label.padEnd(DETECTION_LABEL_WIDTH)} ${items.join(' '.repeat(DETECTION_GAP_WIDTH))}`;
}

function formatDetectedScopes(summary: DetectionSummary): string | undefined {
    const paths = summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.path);
    if (summary.scopes.length <= 1) return formatDetectionRow('scopes', paths);
    const sources = new Set(summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.origin));
    let note = 'from gspot.toml';
    if (sources.has('project')) note = 'a project file in each';
    return formatDetectionRow('scopes', [...paths, note]);
}

function formatExistingTools(summary: DetectionSummary): (string | undefined)[] {
    const { existingTools } = summary;
    const hooks = existingTools.hooks.map(
        (hook) => `${hook.path}/  ${hook.files.join(', ')} (${hook.kind === 'husky' ? 'husky' : 'your own'})`,
    );
    const lint = existingTools.lintFolders.map((folder) => `${folder}/`);
    return [
        formatDetectionRow('hooks', hooks.length === 0 ? ['none'] : hooks),
        formatDetectionRow('ci', existingTools.ci.length === 0 ? ['none'] : existingTools.ci),
        formatDetectionRow('agent files', [
            ...existingTools.agentFiles,
            ...existingTools.ruleFolders.map((folder) => `${folder}/`),
        ]),
        formatDetectionRow('lint folders', lint.length === 0 ? [] : [...lint, 'yours; gspot leaves them alone']),
    ];
}

function formatReplacedFiles(summary: DetectionSummary): string[] {
    const lines = [
        formatDetectionRow('gspot replaces', summary.owned),
        formatDetectionRow('gspot leaves', summary.unowned),
    ].filter((line) => line !== undefined);
    return lines.length === 0 ? [] : [...lines, ''];
}

/**
 * Format the detection header: tracked files, the evidence for each group, scopes, and existing tools.
 * @param summary what init detected.
 * @returns the text, with a final blank line when the repository has existing tools.
 */
function formatDetection(summary: DetectionSummary): string {
    const languages = summary.detected
        .filter(
            (evidence) =>
                evidence.group === 'language' &&
                summary.manifests.get(evidence.configuration)?.configuration.always_selected !== true,
        )
        .map((evidence) => `${evidence.configuration} ${evidence.evidence.split(' ', 1)[0] ?? ''}`);
    const rows = [
        formatDetectionRow(GROUP_LABELS.language.toLowerCase(), languages),
        ...Object.entries(GROUP_LABELS)
            .filter(([group]) => group !== 'language' && group !== 'general')
            .map(([group, label]) =>
                formatDetectionRow(
                    label.toLowerCase(),
                    summary.detected
                        .filter(
                            (evidence) =>
                                evidence.group === group &&
                                summary.manifests.get(evidence.configuration)?.configuration.always_selected !== true,
                        )
                        .map((evidence) => `${evidence.configuration}  ${evidence.evidence}`),
                ),
            ),
        formatDetectedScopes(summary),
        ...formatExistingTools(summary),
    ].filter((line) => line !== undefined);
    return [
        `reading ${summary.files.length.toLocaleString('en-US')} tracked files`,
        ...(summary.hasGit
            ? []
            : ['no git repository: the hooks and the configurations that read git stay out until git init runs']),
        '',
        ...rows,
        '',
        ...formatReplacedFiles(summary),
    ].join('\n');
}

export { buildInitPlan, formatInitPlan, formatDetection };
