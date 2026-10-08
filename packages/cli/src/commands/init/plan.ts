// The plan initialization shows before writing files, including dry runs.
import { colors } from '#cli/terminal/public.ts';
import { compact } from '#cli/platform/contracts.ts';
import { duplicateMisePins } from '#cli/tools/public.ts';
import { misePins } from '#cli/configurations/public.ts';
import type { Policy } from '#cli/types/policy/settings.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { CI_FILE_NOTES } from '#cli/config/generation/ci.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import { getSubmodulePaths } from '#cli/repository/contracts.ts';
import type { Tooling } from '#cli/types/repository/inventory.ts';
import { getLintJobs } from '#cli/repository/discovery/public.ts';
import { ciNpmInstall } from '#cli/generation/documents/public.ts';
import type { DuplicateMisePin } from '#cli/types/tools/install.ts';
import { npmPins, pythonPins } from '#cli/configurations/contracts.ts';
import type { InitPlan, Planning, InitAnswers, InitFileRow } from '#cli/types/commands/init.ts';

import {
    CI_SETUP,
    HOOKS_ROW,
    COLUMN_GAP,
    REASON_WIDTH,
    ATTRIBUTES_ROW,
    CONFIGURATION_WIDTH,
} from '#cli/config/commands/init.ts';
import {
    DOT_GSPOT,
    POLICY_FILE,
    VERSION_FILE,
    MISE_CONFIG_PATH,
    TOOL_PYTHON_PROJECT,
    TOOL_PACKAGE_PROJECT,
} from '#cli/config/platform/locations.ts';

function runnerRows(answers: InitAnswers, everySelected: Manifest[]): InitPlan['change'] {
    const count = Object.keys(npmPins(everySelected, answers.runner)).length;
    const rows: InitPlan['change'] =
        count === 0
            ? []
            : [{ path: TOOL_PACKAGE_PROJECT, note: `${String(count)} pinned npm tools; matching lockfile` }];
    const python = pythonPins(everySelected).length;
    if (python > 0)
        rows.push({
            path: TOOL_PYTHON_PROJECT,
            note: `${String(python)} pinned Python tools; matching uv.lock and tool environment`,
        });
    if (answers.runner === 'mise')
        rows.unshift({
            path: MISE_CONFIG_PATH,
            note: `${String(misePins(everySelected).length)} tool pins`,
        });
    return rows;
}

// What stops running once gspot runs the same tools: lint folders, lint-only manifests, and duplicate pins.
function noLongerRuns(tooling: Tooling, duplicatePins: DuplicateMisePin[]): InitFileRow[] {
    const list = tooling.lintFolders.map((folder) => ({
        path: `${folder}/`,
        note: 'a folder of lint scripts; check remaining references before deleting it',
    }));
    for (const manifest of tooling.lintOnlyManifests)
        list.push({ path: manifest, note: 'a manifest whose dependencies are all tools gspot now pins' });
    if (duplicatePins.length > 0) {
        const noun = duplicatePins.length === 1 ? 'pin' : 'pins';
        list.push({
            path: 'mise.toml',
            note: `${String(duplicatePins.length)} ${noun} gspot also pins (gspot doctor lists them)`,
        });
    }
    return list;
}

// The CI files init leaves alone: every one when no workflow is written, and every existing lint job.
function retainedCiRows(ci: InitAnswers['ci'], ciFiles: string[], lintJobs: string[]): InitPlan['retained'] {
    const untouched =
        ci === 'none' && lintJobs.length === 0
            ? ciFiles.map((path) => ({
                  path,
                  note: 'CI retained; add the setup commands listed below',
              }))
            : [];
    const jobs = lintJobs.map((path) => ({ path, note: 'existing lint job retained; no duplicate CI job proposed' }));
    return [...untouched, ...jobs];
}

function section(title: string, rows: InitFileRow[]): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.path.length)) + COLUMN_GAP;
    return [title, ...rows.map((row) => `  ${row.path.padEnd(width)}${row.note}`), ''];
}

function configurationRows({ everySelected, selection }: Planning, { level }: Policy): InitPlan['configurations'] {
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
    return [
        `template    ${template.name}  sha256 ${template.digest}  selection ${template.selection}`,
        ...detected,
        '',
    ];
}

/**
 * Builds the plan init prints before asking to continue.
 * @param planning the init answers and selection
 * @param policy the validated policy
 * @param policyText the authored text
 * @param requirements the applicable manifests
 * @param generated the takeover outputs
 * @returns the plan
 */
export function buildInitPlan(
    planning: Planning,
    policy: Policy,
    policyText: string,
    requirements: Manifest[],
    generated: Generated,
): InitPlan {
    const { root, hasGit, tooling, selection, answers, replaced, options } = planning;
    const template = options.template && {
        name: options.template.tables.template,
        digest: options.template.digest,
        selection: options.template.tables.selection,
        detected: selection.detected
            .map((evidence) => evidence.configuration)
            .filter((id) => !selection.selectedIds.has(id)),
    };
    const change = [ATTRIBUTES_ROW, ...runnerRows(answers, requirements)];
    if (hasGit) {
        change.unshift({ path: '.gitignore', note: 'one managed block' });
        if (answers.hooks) change.push(HOOKS_ROW);
    }
    return {
        ...compact({ template }),
        ...(answers.ci === 'none'
            ? { ci: { commands: [ciNpmInstall(`"$(cat ${VERSION_FILE})"`), ...CI_SETUP.commands] } }
            : {}),
        level: policy.level,
        configurations: configurationRows(planning, policy),
        write: [
            { path: POLICY_FILE, note: `your policy, ${String(policyText.split('\n').length)} lines` },
            { path: `${DOT_GSPOT}/`, note: 'generated configuration and version pin' },
            ...[...generated.files, ...generated.blocks]
                .filter(({ path }) => !path.startsWith(`${DOT_GSPOT}/`) && !change.some((row) => row.path === path))
                .map(({ path }) => ({ path, note: CI_FILE_NOTES[path] ?? 'generated file' })),
        ],
        remove: [
            ...replaced.removed,
            ...(policy.agent_rules.enabled && tooling.agentFiles.includes('CLAUDE.md')
                ? [{ path: 'CLAUDE.md', note: 'its own text moves to the end of AGENTS.md' }]
                : []),
        ],
        unread: replaced.unread,
        retained: [
            ...replaced.retained,
            ...getSubmodulePaths(planning.index).map((path) => ({ path, note: 'submodule; contents are not read' })),
            ...retainedCiRows(answers.ci, tooling.ci, getLintJobs(root, tooling.ci)),
        ],
        change: [...change, ...replaced.changed],
        noLongerRuns: noLongerRuns(tooling, duplicateMisePins(root, requirements, answers.runner)),
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
        ...section(`delete ${dim('(git keeps them: git show HEAD:<path>)')}`, plan.remove),
        ...section('left in place', plan.retained),
        ...section('missing; restore or delete it', plan.unread),
        ...section('change', plan.change),
        ...section('no longer runs; delete when ready', plan.noLongerRuns),
        ...(plan.ci === undefined
            ? []
            : ['CI setup (no workflow generated)', ...plan.ci.commands.map((command) => `  ${command}`), '']),
    ];
    return `${lines.join('\n')}\n`;
}
