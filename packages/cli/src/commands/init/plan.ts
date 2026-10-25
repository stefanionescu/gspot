import { DIGITS_ONLY } from '#cli/config/text.ts';
import { getColors } from '#cli/system/terminal.ts';
import { readLintJobs } from '#cli/repository/setup.ts';
import { extractExtension } from '#cli/system/paths.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { compareText, formatCount } from '#cli/system/text.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { GROUP_LABELS } from '#cli/config/configurations/names.ts';
import { buildFileMatcher } from '#cli/repository/files/selection.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/files/tracked.ts';
import type { PackageJson } from '#cli/types/parsers/projects/dependencies.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';

import {
    type InitPlan,
    type InitScan,
    type InitAnswers,
    type InitFileRow,
    type DetectionSummary,
} from '#cli/types/commands/init.ts';
import {
    HOOKS_ROW,
    COLUMN_GAP,
    ORIGIN_WIDTH,
    ANY_FILE_GLOB,
    CI_FILE_NOTES,
    ATTRIBUTES_ROW,
    DETECTION_GAP_WIDTH,
    CONFIGURATION_WIDTH,
    UNCHECKED_FILES_SHOWN,
    DETECTION_LABEL_WIDTH,
} from '#cli/config/commands/init/plan.ts';

function buildToolProjectRows(configurations: Configuration[]): InitPlan['change'] {
    const pins = listToolProjectPins(configurations);
    const mise = listMisePins(configurations).length;
    const npm = Object.keys(pins.npm).length;
    const python = pins.python.length;
    return [
        ...(mise === 0 ? [] : [{ path: GSPOT_PATHS.miseProject, note: formatCount(mise, 'tool pin') }]),
        ...(npm === 0
            ? []
            : [{ path: GSPOT_PATHS.npmProject, note: `${formatCount(npm, 'pinned npm tool')}; matching lockfile` }]),
        ...(python === 0
            ? []
            : [
                  {
                      path: GSPOT_PATHS.pythonProject,
                      note: `${formatCount(python, 'pinned Python tool')}; matching uv.lock and tool environment`,
                  },
              ]),
    ];
}

function buildToolDependencyRows(
    { repository, repositorySetup }: InitScan,
    requirements: Configuration[],
): InitFileRow[] {
    const toolPackages = new Set(Object.keys(listToolProjectPins(requirements).npm));
    return repositorySetup.toolOnlyPackages.flatMap((path) => {
        const packageJson = readPackageJson(repository.root, path) as PackageJson;
        const names = Object.keys({
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies,
            ...packageJson.optionalDependencies,
        })
            .filter((name) => toolPackages.has(name))
            .toSorted(compareText);
        if (names.length === 0) return [];
        const subject = names.join(', ');
        const verb = names.length === 1 ? 'is' : 'are';
        const pronoun = names.length === 1 ? 'it' : 'them';
        return [
            {
                path,
                note: `${subject} ${verb} now pinned in ${GSPOT_PATHS.npmProject}; remove ${pronoun} from package.json if nothing else uses ${pronoun}`,
            },
        ];
    });
}

function buildKeptCiRows(ci: InitAnswers['ci'], ciFiles: string[], lintJobs: string[]): InitPlan['retained'] {
    const untouched =
        ci === 'none' && lintJobs.length === 0 ? ciFiles.map((path) => ({ path, note: 'existing CI file' })) : [];
    const jobs = lintJobs.map((path) => ({ path, note: 'existing lint job kept. gspot adds no second CI job.' }));
    return [...untouched, ...jobs];
}

function formatFileSection(title: string, rows: InitFileRow[]): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.path.length)) + COLUMN_GAP;
    return [title, ...rows.map((row) => `  ${row.path.padEnd(width)}${row.note}`), ''];
}

function buildConfigurationRows(
    { everySelected, configurations }: InitScan,
    { level }: Settings,
): InitPlan['configurations'] {
    return everySelected.map((configuration) => {
        const checks = configuration.checks.filter((check) => level === 'all' || check.level === 'recommended').length;
        return {
            configuration: configuration.name,
            origin: configurations.origins.get(configuration.name) ?? 'required',
            checks,
            checksOff: configuration.checks.length - checks,
        };
    });
}

function formatConfigurationSection(rows: InitPlan['configurations'], level: InitPlan['level']): string[] {
    if (rows.length === 0) return ['configurations', '  none', ''];
    const lines = rows.map((row) => {
        return `  ${row.configuration.padEnd(CONFIGURATION_WIDTH)} ${row.origin.padEnd(ORIGIN_WIDTH)} ${formatCount(row.checks, 'check')} (${String(row.checksOff)} off at ${level})`;
    });
    return ['configurations', ...lines, ''];
}

/**
Build the plan that init shows before you accept it: the configurations, and the files that init writes, deletes,
leaves in place, and changes.

@param scan the repository facts, answers, and configurations.
@param settings the validated gspot.toml and its generated files.
@param settings.settings the parsed gspot.toml for file generation.
@param settings.settingsText the proposed gspot.toml text.
@param settings.requirements the configurations whose tools the checks need.
@param settings.generated the files to write and their ownership plan.
@returns the plan that init proposes.
*/
export function planInitFiles(
    scan: InitScan,
    {
        settings,
        settingsText,
        requirements,
        generated,
    }: { settings: Settings; settingsText: string; requirements: Configuration[]; generated: GenerationResult },
): InitPlan {
    const { repository, repositorySetup, answers, conflicts } = scan;
    const { root, hasGit } = repository;
    const change = buildToolProjectRows(requirements);
    if (hasGit) {
        change.unshift({ path: GITIGNORE_FILE, note: 'one managed block' }, ATTRIBUTES_ROW);
        if (answers.hooks) change.push(HOOKS_ROW);
    }
    const write: InitPlan['write'] = [
        { path: SETTINGS_FILE, note: `your settings, ${String(settingsText.split('\n').length)} lines` },
        { path: `${GSPOT_FOLDER}/`, note: 'generated files and version pin' },
        ...[...generated.files, ...generated.blocks]
            .filter(({ path }) => !path.startsWith(`${GSPOT_FOLDER}/`) && change.every((row) => row.path !== path))
            .map(({ path }) => {
                const replaced = conflicts.deleted.find((row) => row.path === path);
                if (replaced !== undefined)
                    return {
                        path,
                        note: [
                            `replaces your file; read the old one with git show HEAD:${path}`,
                            ...replaced.note.split(';').slice(1),
                        ].join(';'),
                    };
                return {
                    path,
                    note: Object.hasOwn(CI_FILE_NOTES, path)
                        ? CI_FILE_NOTES[path as keyof typeof CI_FILE_NOTES]
                        : 'generated file',
                };
            }),
    ];
    return {
        level: settings.level,
        configurations: buildConfigurationRows(scan, settings),
        write,
        delete: conflicts.deleted.filter(({ path }) => write.every((row) => row.path !== path)),
        retained: [
            ...conflicts.kept,
            ...listSubmodulePaths(repository.index).map((path) => ({ path, note: 'submodule; init does not read it' })),
            ...buildKeptCiRows(answers.ci, repositorySetup.ci, readLintJobs(root, repositorySetup.ci)),
            ...scan.foreignDisableComments,
        ],
        change: [...change, ...conflicts.changed, ...buildToolDependencyRows(scan, requirements)],
        noLongerRuns: repositorySetup.lintFolders.map((folder) => ({
            path: `${folder}/`,
            note: 'a folder of lint scripts; check remaining references before deleting it',
        })),
    };
}

/**
Format the plan that init prints before it writes anything.

@param plan the configurations and file changes to preview.
@returns the text.
*/
export function formatInitPlan(plan: InitPlan): string {
    const { dim } = getColors();
    const lines = [
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

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 10 calls in this file share it.
function formatDetectionRow(label: string, names: string[]): string | undefined {
    return names.length === 0
        ? undefined
        : `${label.padEnd(DETECTION_LABEL_WIDTH)} ${names.join(' '.repeat(DETECTION_GAP_WIDTH))}`;
}

function formatDetectedScopes(summary: DetectionSummary): string | undefined {
    const paths = summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.path);
    if (summary.scopes.length <= 1) return formatDetectionRow('scopes', paths);
    const sources = new Set(summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.origin));
    let note = 'from gspot.toml';
    if (sources.has('project')) note = 'a project file in each';
    return formatDetectionRow('scopes', [...paths, note]);
}

function formatDetectedTools(summary: DetectionSummary): (string | undefined)[] {
    const { repositorySetup } = summary;
    const hooks = repositorySetup.hooks.map(
        (hook) => `${hook.path}/  ${hook.files.join(', ')} (${hook.kind === 'husky' ? 'husky' : 'your own'})`,
    );
    const lint = repositorySetup.lintFolders.map((folder) => `${folder}/`);
    return [
        formatDetectionRow('existing hooks', hooks.length === 0 ? ['none'] : hooks),
        formatDetectionRow('existing ci', repositorySetup.ci.length === 0 ? ['none'] : repositorySetup.ci),
        ...(summary.ciProvider === 'none'
            ? [
                  formatDetectionRow('ci workflow', [
                      'none: no GitHub or GitLab remote or CI file. Run gspot set ci.enabled true later.',
                  ]),
              ]
            : []),
        formatDetectionRow('agent files', [
            ...repositorySetup.agentFiles,
            ...repositorySetup.ruleFolders.map((folder) => `${folder}/`),
        ]),
        formatDetectionRow('lint folders', lint.length === 0 ? [] : [...lint, 'old lint setup; gspot replaces it']),
    ];
}

function formatUncheckedFiles(summary: DetectionSummary): string[] {
    const matchers = summary.configurationsByName
        .values()
        .flatMap((configuration) => [
            configuration.files,
            ...configuration.checks.flatMap((check) => check.files ?? []),
        ])
        .map((files) => buildFileMatcher({ ...files, paths: files.paths.filter((path) => !ANY_FILE_GLOB.test(path)) }))
        .toArray();
    const files = summary.files.filter((file) => file.kind === 'source' && matchers.every((matches) => !matches(file)));
    const extensions = [...new Set(files.map((file) => extractExtension(file.path)))].filter(
        (extension) => extension !== '',
    );
    return extensions.flatMap((extension) =>
        files
            .filter((file) => extractExtension(file.path) === extension)
            .slice(0, UNCHECKED_FILES_SHOWN)
            .map(
                (file) =>
                    formatDetectionRow('not checked', [
                        `${file.path} (no configuration reads ${extension} files)`,
                    ]) as string,
            ),
    );
}

function formatConflictingConfigFiles(summary: DetectionSummary): string[] {
    const lines = [
        formatDetectionRow('gspot replaces', summary.owned),
        formatDetectionRow('gspot leaves', summary.unowned),
    ].filter((line) => line !== undefined);
    return lines.length === 0 ? [] : [...lines, ''];
}

/**
Format the detection header: tracked files, the evidence for each group, scopes, and existing tools.

@param summary what init detected.
@returns the text, with a final blank line when the repository has existing tools.
*/
export function formatDetection(summary: DetectionSummary): string {
    const detected = summary.detected.filter(
        (evidence) => summary.configurationsByName.get(evidence.configuration)?.always_selected !== true,
    );
    const languages = detected
        .filter((evidence) => evidence.group === 'language')
        .map((evidence) => {
            const count = evidence.evidence.split(' ', 1)[0] ?? '';
            return DIGITS_ONLY.test(count)
                ? `${evidence.configuration} ${count}`
                : `${evidence.configuration} (${evidence.evidence})`;
        });
    const rows = [
        formatDetectionRow(GROUP_LABELS.language.toLowerCase(), languages),
        ...formatUncheckedFiles(summary),
        ...Object.entries(GROUP_LABELS)
            .filter(([group]) => group !== 'language' && group !== 'general')
            .map(([group, label]) =>
                formatDetectionRow(
                    label.toLowerCase(),
                    detected
                        .filter((evidence) => evidence.group === group)
                        .map((evidence) => `${evidence.configuration}  ${evidence.evidence}`),
                ),
            ),
        formatDetectedScopes(summary),
        ...formatDetectedTools(summary),
    ].filter((line) => line !== undefined);
    return [
        `reading ${summary.files.length.toLocaleString('en-US')} ${summary.files.length === 1 ? 'file' : 'files'}: tracked, and untracked but not ignored`,
        ...(summary.hasGit
            ? []
            : ['no git repository: the hooks and the configurations that read git stay out until git init runs']),
        '',
        ...rows,
        '',
        ...formatConflictingConfigFiles(summary),
    ].join('\n');
}
