import { selectKits } from '#cli/kits/select.ts';
import type { Manifest } from '#cli/types/kits.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { xcodePlan } from '#cli/commands/init/xcode.ts';
import { agentFiles } from '#cli/agents/instructions.ts';
import { npmPins, pythonPins } from '#cli/tools/pins.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import { misePins, pinnedTwice } from '#cli/tools/mise.ts';
import { scopeAncestors } from '#cli/repository/scopes.ts';
import { submodulePaths } from '#cli/repository/tracked.ts';
import { MISE_CONFIG_PATH } from '#cli/config/tools/tools.ts';
import { ciLintJobs } from '#cli/repository/existing-tooling.ts';
import { SECONDS_PER_DAY, DEFAULT_RELEASE_AGE_DAYS } from '#cli/config/generation.ts';
import type { ScopeEntry, ExistingTooling } from '#cli/types/repository/repository.ts';
import { CI_SETUP, HOOKS_ROW, CURSOR_RULE, XCODE_PROJECT_SETTING } from '#cli/config/commands/init.ts';

import type {
    Planning,
    InitAnswers,
    ReplacePlan,
    InitSelection,
    DetectedSetting,
    InstallSettings,
    InitPlan as Plan,
} from '#cli/types/commands.ts';

function runnerRows(answers: InitAnswers, everySelected: Manifest[]): ReplacePlan['change'] {
    const count = Object.keys(npmPins(everySelected, answers.runner)).length;
    const rows: ReplacePlan['change'] =
        count === 0
            ? []
            : [{ path: '.gspot/package.json', note: `${String(count)} pinned npm tools; matching lockfile` }];
    const python = pythonPins(everySelected).length;
    if (python > 0)
        rows.push({
            path: '.gspot/pyproject.toml',
            note: `${String(python)} pinned Python tools; matching uv.lock and private environment`,
        });
    if (answers.runner === 'mise')
        rows.unshift({
            path: MISE_CONFIG_PATH,
            note: `${String(misePins(everySelected, count > 0).length)} tool pins`,
        });
    return rows;
}

// The install settings a bunfig.toml carries into the policy: the release age floor and the security scanner.
function bunfigSettings(text: string): InstallSettings {
    const document = Bun.TOML.parse(text) as Record<string, unknown>;
    const install = document['install'] as Record<string, unknown> | undefined;
    const age = install?.['minimumReleaseAge'];
    const scanner = (install?.['security'] as Record<string, unknown> | undefined)?.['scanner'];
    return {
        ...(typeof age === 'number'
            ? { min_release_age_days: Math.max(DEFAULT_RELEASE_AGE_DAYS, age / SECONDS_PER_DAY) }
            : {}),
        ...(typeof scanner === 'string' ? { security_scanner: scanner } : {}),
    };
}

// The install settings of every scope's bunfig.toml, for the policy's install tables.
function bunfigInstall(root: string, selection: InitSelection): NonNullable<Plan['install']> {
    const files = openRoot(root);
    try {
        return [...new Set(['', ...selection.scopes.map((scope) => scope.path)])].flatMap((path) => {
            const source = files.read(path === '' ? 'bunfig.toml' : `${path}/bunfig.toml`);
            if (source === undefined) return [];
            const settings = bunfigSettings(source.bytes.toString('utf8'));
            return Object.keys(settings).length === 0 ? [] : [{ path, settings }];
        });
    } finally {
        files.close();
    }
}

// What stops running once gspot runs the same tools: lint folders, lint-only manifests, and duplicate pins.
function noLongerRuns(
    tooling: ExistingTooling,
    duplicatePins: { tool: string; version: string; place: string }[],
): { path: string; note: string }[] {
    const list = tooling.lintFolders.map((folder) => ({
        path: `${folder}/`,
        note: 'a folder of lint scripts; check remaining references before deleting it',
    }));
    for (const manifest of tooling.lintOnlyManifests)
        list.push({ path: manifest, note: 'a manifest whose dependencies are all tools gspot now pins' });
    const [first] = duplicatePins;
    if (first) {
        const noun = duplicatePins.length === 1 ? 'pin' : 'pins';
        list.push({
            path: first.place,
            note: `${String(duplicatePins.length)} ${noun} gspot also pins (gspot doctor lists them)`,
        });
    }
    return list;
}

// The commit scopes a scoped repository with the commits configuration accepts, or undefined for none.
function commitScopeNames(scopes: ScopeEntry[], selection: InitSelection): string[] | undefined {
    if (scopes.length === 0 || !selection.selectedIds.has('commits')) return undefined;
    return [...scopes.map((scope) => scope.name), 'root', 'hooks', 'deps'];
}

// The Xcode project plan, when a kit selected for the scope that holds the project declares the Xcode settings.
function xcodeRow(root: string, selection: InitSelection): ReturnType<typeof xcodePlan> | undefined {
    if (!selection.selectedIds.has('xcode')) return undefined;
    const found = xcodePlan(
        root,
        selection.scopes.map((scope) => scope.path),
    );
    if (found === undefined) return undefined;
    const scopes = selection.scopes.map((scope) => ({
        path: scope.path,
        kits: selection.scopePlans.get(scope.path) ?? [],
    }));
    const kits = [...selection.rootIds, ...scopeAncestors(scopes, found.scope).flatMap((entry) => entry.kits)];
    const declared = selectKits(kits, kitManifests()).some((manifest) =>
        manifest.settings.some((setting) => setting.name === XCODE_PROJECT_SETTING),
    );
    return declared ? found : undefined;
}

// The agent instruction files init writes, when any agent is configured.
function agentRows(agents: string[]): ReplacePlan['write'] {
    if (agents.length === 0) return [];
    const files = agents.map((path) => ({
        path,
        note: path === CURSOR_RULE ? 'owned Cursor rule; authored files preserved' : 'managed instruction block',
    }));
    return [...files, { path: '.gspot/guides/', note: 'agent guides' }];
}

// The CI workflow init writes for the chosen host.
function ciRows(ci: InitAnswers['ci']): ReplacePlan['write'] {
    if (ci === 'none') return [];
    if (ci === 'github') return [{ path: '.github/workflows/gspot.yml', note: 'check workflow' }];
    return [{ path: '.gitlab/ci/gspot.yml', note: 'add include: [{ local: .gitlab/ci/gspot.yml }] to .gitlab-ci.yml' }];
}

// The CI files init leaves alone: every one when no workflow is written, and every existing lint job.
function retainedCiRows(ci: InitAnswers['ci'], ciFiles: string[], lintJobs: string[]): ReplacePlan['retained'] {
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

/**
 * Builds the plan gspot.toml is rendered from.
 * @param root the repository root
 * @param selection what init selected
 * @param answers the answers to the init questions
 * @param detected the settings init filled from the repository
 * @returns the plan
 */
export function plan(
    root: string,
    selection: InitSelection,
    answers: InitAnswers,
    detected: DetectedSetting[] = [],
): Plan {
    const install = selection.selectedIds.has('dependencies') ? bunfigInstall(root, selection) : [];
    const scopes: ScopeEntry[] = selection.scopes.filter((scope) => scope.path !== '');
    const commitScopes = commitScopeNames(scopes, selection);
    const xcode = xcodeRow(root, selection);
    return {
        kits: selection.rootIds,
        scopes: scopes.map((scope) => ({
            path: scope.path,
            kits: selection.scopePlans.get(scope.path) ?? [],
        })),
        hooks: answers.hooks,
        ci: answers.ci,
        rules: answers.isRules,
        runner: answers.runner,
        ...(install.length === 0 ? {} : { install }),
        ...(commitScopes ? { commitScopes } : {}),
        ...(xcode ? { xcode } : {}),
        ...(detected.length === 0 ? {} : { detected }),
    };
}

/**
 * Builds the plan init prints before asking to continue.
 * @param planning the selection, the answers, and the replaced configuration
 * @param policy the validated proposed policy
 * @param policyText the proposed policy text
 * @returns the plan
 */
export function buildInitPlan(planning: Planning, policy: Policy, policyText: string): ReplacePlan {
    const { root, tooling, everySelected, selection, answers, replaced, options } = planning;
    const profile =
        options.profile === undefined
            ? undefined
            : {
                  name: options.profile.tables.profile,
                  digest: options.profile.digest,
                  selection: options.profile.tables.selection,
                  detected: selection.rootPlans.map((plan) => plan.kit).filter((id) => !selection.selectedIds.has(id)),
              };
    const agents = policy.guides.install ? agentFiles(root, policy.guides.agents) : [];
    const policyLines = policyText.split('\n').length;
    const lintJobs = ciLintJobs(root, tooling.ci);
    return {
        ...(profile ? { profile } : {}),
        ...(answers.ci === 'none' ? { ci: CI_SETUP } : {}),
        kits: everySelected.map((manifest) => ({
            kit: manifest.kit.name,
            how: selection.how.get(manifest.kit.name) ?? 'required',
            checks: manifest.checks.length,
        })),
        write: [
            { path: 'gspot.toml', note: `your policy, ${String(policyLines)} lines` },
            { path: '.gspot/', note: 'generated configuration and version pin' },
            ...everySelected
                .flatMap((manifest) => manifest.configs)
                .map((config) => config.pointer?.path)
                .filter((path) => path !== undefined)
                .map((path) => ({ path, note: 'pointer' })),
            ...agentRows(agents),
            ...ciRows(answers.ci),
        ],
        remove: replaced.removed,
        unread: replaced.unread,
        retained: [
            ...replaced.retained,
            ...submodulePaths(root).map((path) => ({ path, note: 'submodule; contents are not read' })),
            ...retainedCiRows(answers.ci, tooling.ci, lintJobs),
        ],
        change: [
            { path: '.gitignore', note: 'one managed block' },
            { path: '.gitattributes', note: 'managed generated-file classification and LF line endings' },
            ...runnerRows(answers, everySelected),
            ...(answers.hooks === 'gspot' ? [HOOKS_ROW] : []),
        ],
        noLongerRuns: noLongerRuns(tooling, pinnedTwice(root, everySelected)),
    };
}
