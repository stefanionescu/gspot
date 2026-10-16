// The plan initialization shows before writing files, including dry runs.
import { colors } from '#cli/system/terminal.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { readLintJobs } from '#cli/repository/tooling.ts';
import { submodulePaths } from '#cli/repository/tracked.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import type { PackageJson } from '#cli/types/parsers/dependency-files.ts';
import { misePins, toolProjectPins } from '#cli/configurations/tool-pins.ts';
import type { InitPlan, InitAnswers, InitFileRow, InitPlanInputs } from '#cli/types/commands/init.ts';

import {
    HOOKS_ROW,
    COLUMN_GAP,
    REASON_WIDTH,
    CI_FILE_NOTES,
    ATTRIBUTES_ROW,
    CONFIGURATION_WIDTH,
} from '#cli/config/commands/init.ts';
import {
    DOT_GSPOT,
    SETTINGS_FILE,
    NPM_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';

function toolProjectRows(everySelected: Manifest[]): InitPlan['change'] {
    const pins = toolProjectPins(everySelected);
    const count = Object.keys(pins.npm).length;
    const rows: InitPlan['change'] =
        count === 0
            ? []
            : [{ path: NPM_TOOL_PROJECT_FILE, note: `${String(count)} pinned npm tools; matching lockfile` }];
    const python = pins.python.length;
    if (python > 0)
        rows.push({
            path: PYTHON_TOOL_PROJECT_FILE,
            note: `${String(python)} pinned Python tools; matching uv.lock and tool environment`,
        });
    if (misePins(everySelected).length > 0)
        rows.unshift({
            path: MISE_TOOL_PROJECT_FILE,
            note: `${String(misePins(everySelected).length)} tool pins`,
        });
    return rows;
}

// Name dependencies that the generated tool project now pins without deleting the authored manifest.
function buildPinnedDependencyRows({ root, tooling }: InitPlanInputs, requirements: Manifest[]): InitFileRow[] {
    const pinned = new Set(Object.keys(toolProjectPins(requirements).npm));
    return tooling.lintOnlyManifests.flatMap((path) => {
        const manifest = readPackageJson(root, path) as PackageJson;
        const names = [
            ...new Set(
                Object.keys({
                    ...manifest.dependencies,
                    ...manifest.devDependencies,
                    ...manifest.peerDependencies,
                    ...manifest.optionalDependencies,
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

// The CI files init leaves alone: every one when init writes no workflow, and every existing lint job.
function keptCiRows(ci: InitAnswers['ci'], ciFiles: string[], lintJobs: string[]): InitPlan['retained'] {
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

function section(title: string, rows: InitFileRow[]): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.path.length)) + COLUMN_GAP;
    return [title, ...rows.map((row) => `  ${row.path.padEnd(width)}${row.note}`), ''];
}

function configurationRows(
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

function configurationSection(rows: InitPlan['configurations'], level: InitPlan['level']): string[] {
    if (rows.length === 0) return ['configurations', '  none', ''];
    const lines = rows.map((row) => {
        const noun = row.checks === 1 ? 'check' : 'checks';
        return `  ${row.configuration.padEnd(CONFIGURATION_WIDTH)} ${row.how.padEnd(REASON_WIDTH)} ${String(row.checks)} ${noun} (${String(row.checksOff)} off at ${level})`;
    });
    return ['configurations', ...lines, ''];
}

function templateSection(template: InitPlan['template']): string[] {
    if (!template) return [];
    const detected = template.detected.map(
        (id) => `  detected, not in the template: ${id}  (add it afterwards: gspot add ${id})`,
    );
    return [`template    ${template.source}  sha256 ${template.digest}`, ...detected, ''];
}

/**
 * Builds the plan init prints before asking to continue.
 * @param planning the init answers and selection
 * @param settings the validated settings
 * @param settingsText the written text
 * @param requirements the applicable manifests
 * @param generated the generated files init will write
 * @returns the plan
 */
export function buildInitPlan(
    planning: InitPlanInputs,
    settings: Settings,
    settingsText: string,
    requirements: Manifest[],
    generated: Generated,
): InitPlan {
    const { root, hasGit, tooling, selection, answers, replaced, options } = planning;
    const template = options.template && {
        source: options.template.source,
        digest: options.template.digest,
        detected: selection.detected
            .map((evidence) => evidence.configuration)
            .filter((id) => !selection.selectedIds.has(id)),
    };
    const change = [ATTRIBUTES_ROW, ...toolProjectRows(requirements)];
    if (hasGit) {
        change.unshift({ path: '.gitignore', note: 'one managed block' });
        if (answers.hooks) change.push(HOOKS_ROW);
    }
    return {
        ...stripUndefined({ template }),
        level: settings.level,
        configurations: configurationRows(planning, settings),
        write: [
            { path: SETTINGS_FILE, note: `your settings, ${String(settingsText.split('\n').length)} lines` },
            { path: `${DOT_GSPOT}/`, note: 'generated files and version pin' },
            ...[...generated.files, ...generated.blocks]
                .filter(({ path }) => !path.startsWith(`${DOT_GSPOT}/`) && !change.some((row) => row.path === path))
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
            ...submodulePaths(planning.index).map((path) => ({ path, note: 'submodule; contents are not read' })),
            ...keptCiRows(answers.ci, tooling.ci, readLintJobs(root, tooling.ci)),
        ],
        change: [...change, ...replaced.changed, ...buildPinnedDependencyRows(planning, requirements)],
        noLongerRuns: tooling.lintFolders.map((folder) => ({
            path: `${folder}/`,
            note: 'a folder of lint scripts; check remaining references before deleting it',
        })),
    };
}

/**
 * The plan init prints before writing anything.
 * @param plan the plan
 * @returns the text
 */
export function initPlanText(plan: InitPlan): string {
    const { dim } = colors;
    const lines = [
        ...templateSection(plan.template),
        ...configurationSection(plan.configurations, plan.level),
        ...section('write', plan.write),
        ...section(`delete ${dim('(git keeps them: git show HEAD:<path>)')}`, plan.delete),
        ...section('left in place', plan.retained),
        ...section('change', plan.change),
        ...section('no longer runs; delete when ready', plan.noLongerRuns),
        'Change these later with gspot set hooks.enabled, ci.enabled, ci.provider, or rules.enabled.',
    ];
    return `${lines.join('\n')}\n`;
}
