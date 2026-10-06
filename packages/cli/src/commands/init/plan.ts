// The plan initialization shows before writing files, including dry runs.
import { colors } from '#cli/output/messages.ts';
import { compact } from '#cli/platform/objects.ts';
import { getLintJobs } from '#cli/repository/survey.ts';
import { npmPins, pythonPins } from '#cli/tools/pins.ts';
import type { Policy } from '#cli/types/policy/settings.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { misePins, duplicateMisePins } from '#cli/tools/mise.ts';
import type { Tooling } from '#cli/types/repository/inventory.ts';
import type { DuplicateMisePin } from '#cli/types/tools/install.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';
import { readIndexEntries, getSubmodulePaths } from '#cli/repository/tracked.ts';
import type { InitPlan, Planning, InitAnswers, InitFileRow } from '#cli/types/commands/init.ts';
import { CI_SETUP, HOOKS_ROW, COLUMN_GAP, REASON_WIDTH, CONFIGURATION_WIDTH } from '#cli/config/commands/init.ts';

import {
    DOT_GSPOT,
    POLICY_FILE,
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
            note: `${String(python)} pinned Python tools; matching uv.lock and private environment`,
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

// The agent instruction files init writes, when any agent is configured.
function agentRows(agents: string[], rules: string): InitPlan['write'] {
    if (agents.length === 0) return [];
    const files = agents.map((path) => ({ path, note: 'managed instruction block' }));
    return [...files, { path: `${rules}/`, note: 'agent rules' }];
}

// The CI workflow init writes for the chosen host.
function ciRows(ci: InitAnswers['ci']): InitPlan['write'] {
    if (ci === 'none') return [];
    if (ci === 'github') return [{ path: GITHUB_WORKFLOW, note: 'check workflow' }];
    return [{ path: GITLAB_WORKFLOW, note: `add include: [{ local: ${GITLAB_WORKFLOW} }] to .gitlab-ci.yml` }];
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

function configurationSection(rows: InitPlan['configurations']): string[] {
    if (rows.length === 0) return ['configurations', '  none', ''];
    const lines = rows.map((row) => {
        const noun = row.checks === 1 ? 'check' : 'checks';
        return `  ${row.configuration.padEnd(CONFIGURATION_WIDTH)} ${row.how.padEnd(REASON_WIDTH)} ${String(row.checks)} ${noun}`;
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
 * @param planning the selection, the answers, and the replaced configuration
 * @param policy the validated proposed policy
 * @param policyText the proposed policy text
 * @param requirements the manifests containing applicable tool requirements
 * @returns the plan
 */
export function buildInitPlan(
    planning: Planning,
    policy: Policy,
    policyText: string,
    requirements: Manifest[],
): InitPlan {
    const { root, hasGit, tooling, everySelected, selection, answers, replaced, options } = planning;
    const template = options.template && {
        name: options.template.tables.template,
        digest: options.template.digest,
        selection: options.template.tables.selection,
        detected: selection.detected
            .map((evidence) => evidence.configuration)
            .filter((id) => !selection.selectedIds.has(id)),
    };
    const agents = policy.agentRules.enabled ? [...new Set(['AGENTS.md', ...policy.agentRules.instruction_files])] : [];
    const submodules = getSubmodulePaths(readIndexEntries(root));
    const change = [
        { path: '.gitattributes', note: 'managed generated-file classification and LF line endings' },
        ...runnerRows(answers, requirements),
    ];
    if (hasGit) {
        change.unshift({ path: '.gitignore', note: 'one managed block' });
        if (answers.hooks) change.push(HOOKS_ROW);
    }
    return {
        ...compact({ template }),
        ...(answers.ci === 'none' ? { ci: CI_SETUP } : {}),
        configurations: everySelected.map((manifest) => ({
            configuration: manifest.configuration.name,
            how: selection.how.get(manifest.configuration.name) ?? 'required',
            checks: manifest.checks.length,
        })),
        write: [
            { path: POLICY_FILE, note: `your policy, ${String(policyText.split('\n').length)} lines` },
            { path: `${DOT_GSPOT}/`, note: 'generated configuration and version pin' },
            ...everySelected
                .flatMap((manifest) => manifest.configs)
                .map((config) => config.stub_file?.path)
                .filter((path) => path !== undefined)
                .map((path) => ({ path, note: 'pointer' })),
            ...agentRows(agents, policy.agentRules.folder),
            ...ciRows(answers.ci),
        ],
        remove: [
            ...replaced.removed,
            ...(policy.agentRules.enabled && tooling.agentFiles.includes('CLAUDE.md')
                ? [{ path: 'CLAUDE.md', note: 'its own text moves to the end of AGENTS.md' }]
                : []),
        ],
        unread: replaced.unread,
        retained: [
            ...replaced.retained,
            ...submodules.map((path) => ({ path, note: 'submodule; contents are not read' })),
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
        ...configurationSection(plan.configurations),
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
