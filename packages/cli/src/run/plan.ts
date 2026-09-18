// The check graph for a run: stage, scope, file sets, requirements, skips.
import { claimedByClaims, claimedFiles, pathMatcher } from '#cli/presets/claims.ts';
import { hasEngine } from '#cli/run/engines.ts';
import type { ScopeSelection, Session } from '#cli/run/session.ts';
import type { RepositoryCheck } from '#types/config.ts';
import type { CheckSpec, Manifest, Stage, ToolPin } from '#types/manifest.ts';
import type { TrackedFile } from '#types/repository.ts';

export type StageFilter = 'all' | 'commit' | 'push' | 'manual' | 'message';

export type PlanOptions = {
    stage: StageFilter;
    staged?: string[];
    since?: string[];
    only?: string;
    scope?: string;
    skips: string[];
    localSkips: string[];
    fix?: boolean;
    messageFile?: string;
};

export type PlannedCheck = {
    id: string;
    scope: ScopeSelection;
    spec: CheckSpec;
    manifest?: Manifest;
    files: TrackedFile[];
    tool?: ToolPin;
    skip?: { source: 'local' | 'flag' | 'platform'; note: string };
    projectWide: boolean;
    messageFile?: string;
};

const PLATFORM_NAMES: Record<string, string> = { darwin: 'macos', linux: 'linux', win32: 'windows' };

function stageMatches(filter: StageFilter, stage: Stage): boolean {
    if (filter === 'all') return stage === 'commit' || stage === 'push';
    return filter === stage;
}

function childScopes(session: Session, scope: ScopeSelection): string[] {
    return session.scopes
        .map((entry) => entry.scope.path)
        .filter(
            (path) =>
                path !== '' &&
                path !== scope.scope.path &&
                (scope.scope.path === '' || path.startsWith(`${scope.scope.path}/`)),
        );
}

function toolFor(spec: CheckSpec, manifest: Manifest | undefined, session: Session): ToolPin | undefined {
    const name = spec.tool ?? spec.command?.[0];
    if (name === undefined) return undefined;
    const own = manifest?.tools.find((tool) => tool.name === name);
    if (own) return own;
    for (const other of session.manifests.values()) {
        const found = other.tools.find((tool) => tool.name === name);
        if (found) return found;
    }
    return { name, windows: true, installers: {} };
}

function fromRepositoryCheck(entry: RepositoryCheck): CheckSpec {
    const spec: CheckSpec = {
        id: entry.id,
        stage: entry.stage,
        takes: 'files',
        command: entry.command,
        inspection: [],
        summary: entry.summary ?? `Runs the repository's own check ${entry.id}.`,
        why: 'The repository declared this command in gspot.toml as part of its gate.',
        fix: 'Read the command output; the repository owns this check.',
        claims: {
            extensions: [],
            filenames: [],
            tags: [],
            paths: entry.paths,
            from_languages: false,
            natures: ['source', 'generated'],
        },
    };
    if (entry.fix) {
        spec.fix_command = entry.fix;
        spec.fix_order = 'codemod';
    }
    if (entry.count_regex !== undefined) spec.count_regex = entry.count_regex;
    if (entry.requires !== undefined) spec.requires = entry.requires;
    if (entry.platform !== undefined) spec.platform = entry.platform;
    return spec;
}

/** Plans every check for the run. */
export function planRun(session: Session, options: PlanOptions): PlannedCheck[] {
    const planned: PlannedCheck[] = [];
    const seenRepositoryChecks = new Set<string>();
    const staged = options.staged ? new Set(options.staged) : undefined;
    const since = options.since ? new Set(options.since) : undefined;
    const narrowed = staged ?? since;
    const platform = PLATFORM_NAMES[process.platform] ?? process.platform;
    for (const scope of session.scopes) {
        if (options.scope !== undefined && scope.scope.path !== options.scope) continue;
        const children = childScopes(session, scope);
        const outsideChildren = (file: TrackedFile) =>
            !children.some((child) => file.path === child || file.path.startsWith(`${child}/`));
        const entries: { spec: CheckSpec; manifest?: Manifest }[] = [];
        for (const manifest of scope.selected) {
            const repositoryKind = manifest.preset.kind === 'repository';
            if (repositoryKind && scope.scope.path !== '' && !manifest.claims.from_languages) continue;
            for (const spec of manifest.checks) {
                if (repositoryKind && !manifest.claims.from_languages && seenRepositoryChecks.has(spec.id)) continue;
                if (repositoryKind && !manifest.claims.from_languages) seenRepositoryChecks.add(spec.id);
                entries.push({ spec, manifest });
            }
        }
        if (scope.scope.path === '')
            for (const entry of session.loaded.policy.checks) entries.push({ spec: fromRepositoryCheck(entry) });
        for (const { spec, manifest } of entries) {
            if (options.only !== undefined && spec.id !== options.only) continue;
            if (!stageMatches(options.stage, spec.stage) && !(options.only !== undefined && options.stage === 'all'))
                continue;
            if (spec.stage === 'message' && options.stage !== 'message') continue;
            if (spec.engine !== undefined && !hasEngine(spec.engine)) continue;
            const whole = manifest?.preset.kind === 'repository' && !manifest.claims.from_languages;
            let files = manifest
                ? spec.claims
                    ? claimedByClaims(spec.claims, scope.selected, session.repository.files, scope.scope.path)
                    : claimedFiles(manifest, scope.selected, session.repository.files, scope.scope.path)
                : session.repository.files.filter((file) => pathMatcher(spec.claims!.paths)(file.path));
            if (!whole) files = files.filter(outsideChildren);
            if (spec.exclude_setting !== undefined) {
                const excluded = (scope.view.settings[spec.exclude_setting] as { paths: string[] }[] | undefined) ?? [];
                const patterns = excluded.flatMap((entry) => entry.paths);
                if (patterns.length > 0) {
                    const matcher = pathMatcher(patterns);
                    files = files.filter((file) => !matcher(file.path));
                }
            }
            let projectWide = spec.takes === 'project';
            if (narrowed) {
                const inNarrowed = files.filter((file) => narrowed.has(file.path));
                const policyTouched =
                    narrowed.has('gspot.toml') || [...narrowed].some((path) => path.startsWith('.gspot/'));
                if (spec.takes === 'files') files = inNarrowed;
                else if (inNarrowed.length === 0 && !policyTouched) files = [];
                if (policyTouched && spec.takes === 'files' && inNarrowed.length === 0)
                    files = manifest
                        ? claimedFiles(manifest, scope.selected, session.repository.files, scope.scope.path).filter(
                              outsideChildren,
                          )
                        : files;
                projectWide = spec.takes === 'project';
            }
            const check: PlannedCheck = { id: spec.id, scope, spec, files, projectWide };
            if (manifest) check.manifest = manifest;
            const tool = spec.engine ? undefined : toolFor(spec, manifest, session);
            if (tool) check.tool = tool;
            if (options.messageFile !== undefined) check.messageFile = options.messageFile;
            if (spec.platform && !spec.platform.includes(platform as 'macos'))
                check.skip = {
                    source: 'platform',
                    note: `runs on ${spec.platform.join(', ')} only; this is ${platform}`,
                };
            else if (tool && !tool.windows && platform === 'windows')
                check.skip = { source: 'platform', note: `${tool.name} has no Windows build` };
            else if (options.localSkips.includes(spec.id))
                check.skip = { source: 'local', note: 'skipped by gspot.local.toml' };
            else if (options.skips.includes(spec.id)) check.skip = { source: 'flag', note: 'skipped by --skip' };
            planned.push(check);
        }
    }
    return planned;
}
