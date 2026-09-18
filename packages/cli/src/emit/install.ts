// init: read the repository, propose a policy, print the plan, write it after a yes, install the tools, baseline the findings.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { newerVersion } from '#cli/doctor/newer-version.ts';
import { note, print, paint } from '#cli/output/messages.ts';
import { renderInitPlan } from '#cli/output/plan.ts';
import { askChoice, askConfirm } from '#cli/output/prompts.ts';
import { hasPolicy } from '#cli/policy/load.ts';
import { proposeText } from '#cli/policy/propose.ts';
import type { Proposal } from '#cli/policy/propose.ts';
import { detectPresets, unknownLanguages } from '#cli/presets/detect.ts';
import { loadManifests } from '#cli/presets/load.ts';
import { selectPresets } from '#cli/presets/select.ts';
import { syncAll } from '#cli/render/sync.ts';
import { collectCarried, deleteReplaced, noLongerRuns, ownedTools, unownedTools } from '#cli/render/takeover.ts';
import { withBlock, gitignoreBlock, fileText } from '#cli/render/managed-blocks.ts';
import { pinnedTwice, collectPins, npmPins, npmScripts } from '#cli/render/runner-surface.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { workspaceScopes } from '#cli/repository/scopes.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { writeBaselines, baselineAllowed } from '#cli/run/baselines.ts';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { GSPOT_VERSION, writePin } from '#cli/run/version-pin.ts';
import { run } from '#cli/platform/spawn.ts';
import { readFileSync } from 'node:fs';
import type { Manifest } from '#types/manifest.ts';
import type { ExistingTooling, ScopeInfo, TrackedFile } from '#types/repository.ts';
import type { TakeoverPlan } from '#types/render.ts';

export type InitOptions = {
    cwd: string;
    yes: boolean;
    dryRun: boolean;
    json: boolean;
    presets?: string[];
    without?: string[];
    scopes?: string[];
    own?: string[];
    hooks?: 'gspot' | 'lefthook' | 'husky' | 'none';
    ci?: 'github' | 'none';
    rules?: 'yes' | 'no';
    format?: 'keep' | 'shipped';
    runner?: 'mise' | 'npm' | 'bun' | 'pnpm' | 'uv' | 'none';
    install: boolean;
    projectTemplates: boolean;
    binaryPath?: string;
};

export type InitResult = { text: string; json: Record<string, unknown>; exitCode: number };

function pad(text: string, width: number): string {
    return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function detectionText(
    files: TrackedFile[],
    proposals: { preset: string; evidence: string; kind: string }[],
    scopes: ScopeInfo[],
    tooling: ExistingTooling,
    owned: string[],
    unowned: string[],
    unknown: { language: string; count: number }[],
    manifests: Map<string, Manifest>,
): string {
    const lines = [`reading ${files.length.toLocaleString('en-US')} tracked files`, ''];
    const byKind = (kind: string) =>
        proposals.filter(
            (proposal) => proposal.kind === kind && manifests.get(proposal.preset)?.preset.default !== true,
        );
    const row = (label: string, items: string[]) => {
        if (items.length > 0) lines.push(`${pad(label, 13)} ${items.join('   ')}`);
    };
    row(
        'languages',
        byKind('language').map((proposal) => `${proposal.preset} ${proposal.evidence.split(' ')[0]}`),
    );
    row(
        'frameworks',
        byKind('framework').map((proposal) => `${proposal.preset}  ${proposal.evidence}`),
    );
    row(
        'platforms',
        byKind('platform').map((proposal) => `${proposal.preset}  ${proposal.evidence}`),
    );
    row(
        'databases',
        byKind('database').map((proposal) => `${proposal.preset}  ${proposal.evidence}`),
    );
    row(
        'tools',
        byKind('tool').map((proposal) => `${proposal.preset}  ${proposal.evidence}`),
    );
    row(
        'libraries',
        byKind('library').map((proposal) => `${proposal.preset}  ${proposal.evidence}`),
    );
    row(
        'scopes',
        scopes
            .filter((scope) => scope.path !== '')
            .map((scope) => scope.path)
            .concat(
                scopes.length > 1
                    ? [
                          `from ${scopes.find((scope) => scope.source === 'workspace') ? 'workspace declarations' : 'gspot.toml'}`,
                      ]
                    : [],
            ),
    );
    row('runner', tooling.runner === 'none' ? ['none'] : [`${tooling.runner}  ${tooling.runnerFile ?? ''}`]);
    row(
        'hooks',
        tooling.hooks.length === 0
            ? ['none']
            : tooling.hooks.map(
                  (hook) =>
                      `${hook.path}/  ${hook.files.join(', ')} (${hook.kind === 'husky' ? 'husky' : 'hand-written'})`,
              ),
    );
    row('ci', tooling.ci.length === 0 ? ['none'] : tooling.ci);
    row('agent files', [...tooling.agentFiles, ...tooling.rulesDirectories.map((dir) => `${dir}/`)]);
    row(
        'lint tooling',
        tooling.lintFolders
            .map((folder) => `${folder}/`)
            .concat(tooling.lintFolders.length > 0 ? ['yours; gspot leaves them alone'] : []),
    );
    for (const entry of unknown)
        lines.push(`${pad('no preset', 13)} ${entry.language}: ${entry.count} files unchecked`);
    lines.push('');
    if (owned.length > 0) lines.push(`already configured   ${owned.join('  ')}`);
    if (unowned.length > 0) lines.push(`no gspot preset      ${unowned.join('  ')}`);
    if (owned.length > 0 || unowned.length > 0) lines.push('');
    return lines.join('\n');
}

function parseScopeFlags(flags: string[] | undefined): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const flag of flags ?? []) {
        const [path, ids] = flag.split('=');
        map.set(
            path!.replace(/\/$/, ''),
            (ids ?? '')
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean),
        );
    }
    return map;
}

function formatDiffers(
    root: string,
    tooling: ExistingTooling,
): Partial<import('#types/config.ts').FormatConfig> | undefined {
    const prettier = tooling.configs.find((config) => config.tool === 'prettier' && config.path.endsWith('.json'));
    const found: Partial<import('#types/config.ts').FormatConfig> = {};
    if (prettier) {
        try {
            const data = JSON.parse(readFileSync(join(root, prettier.path), 'utf8')) as Record<string, unknown>;
            if (typeof data['tabWidth'] === 'number' && data['tabWidth'] !== 4) found.indent_width = data['tabWidth'];
            if (typeof data['printWidth'] === 'number' && data['printWidth'] !== 120)
                found.print_width = data['printWidth'];
            if (data['singleQuote'] === false) found.quotes = 'double';
            if (data['semi'] === false) found.semicolons = false;
            if (data['useTabs'] === true) found.indent_style = 'tab';
            if (typeof data['trailingComma'] === 'string' && data['trailingComma'] !== 'all')
                found.trailing_comma = data['trailingComma'] as 'es5' | 'none';
        } catch {
            // unreadable: the shipped values apply
        }
    }
    return Object.keys(found).length > 0 ? found : undefined;
}

/** Runs init. */
export async function initCommand(options: InitOptions): Promise<InitResult> {
    const root = findRoot(options.cwd);
    if (hasPolicy(root)) {
        return {
            text: 'This repository already has a gspot.toml. Run `gspot doctor` to see what changed since the install and the command that applies each change.\n',
            json: { error: 'already-installed' },
            exitCode: 2,
        };
    }
    const manifests = loadManifests();
    const repository = await readRepository(root, [], []);
    const facts = readManifests(root, repository.files);
    const workspace = workspaceScopes(root, facts);
    const scopeFlags = parseScopeFlags(options.scopes);
    const scopes: ScopeInfo[] = [
        { name: 'root', path: '', presets: [], source: 'root' },
        ...workspace.scopes.filter((scope) => scopeFlags.size === 0 || scopeFlags.has(scope.path)),
    ];
    for (const [path] of scopeFlags)
        if (!scopes.some((scope) => scope.path === path) && existsSync(join(root, path)))
            scopes.push({ name: path.split('/').pop()!, path, presets: [], source: 'gspot.toml' });
    const tooling = existingTooling(root, repository.files, scopes, facts);
    const rootProposals = detectPresets(repository.files, manifests, facts);
    const scopeProposals = new Map<string, string[]>();
    const without = new Set(options.without ?? []);
    const rootIds = options.presets ? options.presets.filter((id) => !without.has(id)) : [];
    if (!options.presets) {
        for (const proposal of rootProposals) {
            const manifest = manifests.get(proposal.preset)!;
            const proposedOnly = manifest.preset.proposed;
            if (without.has(proposal.preset)) continue;
            if (scopes.length > 1 && manifest.preset.kind !== 'repository' && manifest.preset.kind !== 'language')
                continue;
            if (proposedOnly && !options.yes) continue;
            rootIds.push(proposal.preset);
        }
    }
    for (const scope of scopes) {
        if (scope.path === '') continue;
        const flagged = scopeFlags.get(scope.path);
        const ids =
            flagged ??
            detectPresets(repository.files, manifests, facts, scope.path)
                .filter(
                    (proposal) =>
                        !without.has(proposal.preset) &&
                        manifests.get(proposal.preset)?.preset.kind !== 'repository' &&
                        (!manifests.get(proposal.preset)?.preset.proposed || options.yes),
                )
                .map((proposal) => proposal.preset);
        const languageAtRoot = new Set(rootIds);
        scopeProposals.set(
            scope.path,
            ids.filter((id) => !languageAtRoot.has(id) || manifests.get(id)?.preset.kind !== 'language'),
        );
    }
    if (scopes.length > 1) {
        const inScopes = new Set([...scopeProposals.values()].flat());
        for (let i = rootIds.length - 1; i >= 0; i -= 1) {
            const id = rootIds[i]!;
            const manifest = manifests.get(id)!;
            if (manifest.preset.kind === 'language' && inScopes.has(id)) {
                const outside = repository.files.some(
                    (file) =>
                        file.nature === 'source' &&
                        !scopes.some((scope) => scope.path !== '' && file.path.startsWith(`${scope.path}/`)) &&
                        manifest.claims.extensions.some((ext) => file.path.endsWith(ext)),
                );
                if (!outside) rootIds.splice(i, 1);
            }
        }
    }
    const selectedIds = new Set([...rootIds, ...[...scopeProposals.values()].flat()]);
    for (const id of [...selectedIds])
        for (const manifest of selectPresets([id], manifests)) selectedIds.add(manifest.preset.id);
    const owned = ownedTools(tooling, selectedIds);
    const unowned = unownedTools(tooling, selectedIds, manifests);
    const unknown = unknownLanguages(repository.files, manifests);
    const header = detectionText(repository.files, rootProposals, scopes, tooling, owned, unowned, unknown, manifests);
    if (!options.json) print(header);
    const hooksDefault =
        options.hooks ??
        (tooling.hooks.some((hook) => hook.kind === 'husky')
            ? 'husky'
            : tooling.hooks.some((hook) => hook.kind === 'lefthook')
              ? 'lefthook'
              : 'gspot');
    const ciDefault = options.ci ?? (existsSync(join(root, '.github')) && tooling.ci.length === 0 ? 'github' : 'none');
    const runnerDefault = options.runner ?? (tooling.runner === 'yarn' ? 'npm' : tooling.runner);
    const hooks =
        options.hooks ??
        (await askChoice<'gspot' | 'lefthook' | 'husky' | 'none'>(
            'Install git hooks?',
            '--hooks',
            [
                { value: 'gspot', label: 'gspot writes .gspot/hooks' },
                { value: 'lefthook', label: 'a block in lefthook.yml' },
                { value: 'husky', label: 'lines in .husky/' },
                { value: 'none', label: 'no hooks' },
            ],
            hooksDefault,
            options.yes,
        ));
    const ci =
        options.ci ??
        (await askChoice<'github' | 'none'>(
            'Write a CI workflow?',
            '--ci',
            [
                { value: 'github', label: '.github/workflows/gspot.yml' },
                { value: 'none', label: 'no workflow' },
            ],
            ciDefault,
            options.yes,
        ));
    const rules = options.rules
        ? options.rules === 'yes'
        : await askConfirm('Install agent rule files?', '--rules yes|no', true, options.yes);
    const runner =
        options.runner ??
        (await askChoice<'mise' | 'bun' | 'npm' | 'pnpm' | 'uv' | 'none'>(
            'Task runner surface?',
            '--runner',
            [
                { value: 'mise', label: 'mise (.config/mise/conf.d/gspot.toml)' },
                { value: 'bun', label: 'bun (package.json scripts)' },
                { value: 'npm', label: 'npm (package.json scripts)' },
                { value: 'pnpm', label: 'pnpm (package.json scripts)' },
                { value: 'uv', label: 'uv (dependency group)' },
                { value: 'none', label: 'none' },
            ],
            runnerDefault,
            options.yes,
        ));
    const differing = formatDiffers(root, tooling);
    let format: Partial<import('#types/config.ts').FormatConfig> | undefined;
    if (differing) {
        const keep =
            options.format ??
            (await askChoice<'keep' | 'shipped'>(
                'Your formatter settings differ from the shipped ones. Keep yours?',
                '--format keep|shipped',
                [
                    {
                        value: 'keep',
                        label: `keep (${Object.entries(differing)
                            .map(([key, value]) => `${key} ${value}`)
                            .join(', ')})`,
                    },
                    { value: 'shipped', label: 'take the shipped values' },
                ],
                'keep',
                options.yes,
            ));
        if (keep === 'keep') format = differing;
    }
    const carried = collectCarried(root, tooling, selectedIds);
    const commitScopes =
        scopes.length > 1 && selectedIds.has('commits')
            ? [...scopes.filter((scope) => scope.path !== '').map((scope) => scope.name), 'root', 'hooks', 'deps']
            : undefined;
    const proposal: Proposal = {
        presets: rootIds,
        scopes: scopes
            .filter((scope) => scope.path !== '')
            .map((scope) => ({ path: scope.path, presets: scopeProposals.get(scope.path) ?? [] })),
        carried,
        hooks,
        ci,
        rules,
        runner,
        ...(format ? { format } : {}),
        ...(commitScopes ? { commitScopes } : {}),
    };
    const typesDir = ['types', 'src/types', 'api/types'].find((dir) => existsSync(join(root, dir)));
    if (typesDir && [...selectedIds].some((id) => id === 'typescript')) proposal.typesDirectory = typesDir;
    const policyText = proposeText(proposal);
    const everySelected = [...selectedIds].map((id) => manifests.get(id)!);
    const plan: TakeoverPlan = {
        write: [
            { path: 'gspot.toml', note: `your policy, ${policyText.split('\n').length} lines` },
            { path: '.gspot/', note: 'generated configuration, baselines, hooks, version pin' },
        ],
        remove: carried.removed,
        carried: [
            ...(carried.typosWords.length > 0
                ? [{ from: 'typos words', count: carried.typosWords.length, into: 'words' }]
                : []),
            ...(carried.gitleaksAllow.length > 0
                ? [{ from: 'gitleaks allowlist', count: carried.gitleaksAllow.length, into: 'entries' }]
                : []),
            ...(carried.osvIgnores.length > 0
                ? [{ from: 'osv ignores', count: carried.osvIgnores.length, into: 'advisories' }]
                : []),
            ...(carried.licenseExceptions.length > 0
                ? [{ from: 'license exceptions', count: carried.licenseExceptions.length, into: 'exceptions' }]
                : []),
            ...(carried.ignores.length > 0
                ? [{ from: 'rules turned off', count: carried.ignores.length, into: '[[ignore]] entries' }]
                : []),
        ],
        change: [{ path: '.gitignore', note: 'one managed block' }],
        noLongerRuns: noLongerRuns(tooling, pinnedTwice(root, everySelected)),
        baselines: { rules: 0, findings: 0 },
        ignores: carried.ignores,
    };
    for (const stubs of everySelected.flatMap((manifest) =>
        manifest.configs.filter((config) => config.stub).map((config) => config.stub!.path),
    ))
        plan.write.push({ path: stubs, note: 'stub' });
    if (rules)
        plan.write.push(
            { path: 'CLAUDE.md  AGENTS.md', note: 'one managed block each' },
            { path: '.gspot/rules/', note: 'agent rule files' },
        );
    if (runner === 'mise')
        plan.change.push({
            path: '.config/mise/conf.d/gspot.toml',
            note: `${collectPins(everySelected).length} tool pins, 5 tasks`,
        });
    if (runner === 'bun' || runner === 'npm' || runner === 'pnpm')
        plan.change.push({
            path: 'package.json',
            note: `add ${Object.keys(npmPins(everySelected)).length} devDependencies gspot pins; scripts check, check:fix, sync, prepare`,
        });
    const planText = renderInitPlan(plan);
    if (!options.json) print(planText);
    if (options.dryRun) {
        if (!options.json) print('--dry-run: nothing written.\n');
        return { text: '', json: { root, plan, policy: policyText, dryRun: true }, exitCode: 0 };
    }
    const go = await askConfirm('Continue?', '--yes', true, options.yes);
    if (!go) return { text: 'Nothing written.\n', json: { root, plan, written: false }, exitCode: 0 };
    deleteReplaced(root, carried.removed);
    writeFileSync(join(root, 'gspot.toml'), policyText);
    writePin(root, GSPOT_VERSION);
    const gitignore = fileText(root, '.gitignore');
    writeFileSync(join(root, '.gitignore'), withBlock(gitignore, gitignoreBlock(), 'hash'));
    if (runner === 'bun' || runner === 'npm' || runner === 'pnpm') {
        const { default: PackageJson } = await import('@npmcli/package-json');
        const pkg = existsSync(join(root, 'package.json'))
            ? await PackageJson.load(root)
            : await PackageJson.create(root);
        const current = pkg.content as { devDependencies?: Record<string, string>; scripts?: Record<string, string> };
        pkg.update({
            devDependencies: { ...(current.devDependencies ?? {}), ...npmPins(everySelected) },
            scripts: { ...(current.scripts ?? {}), ...npmScripts() },
        });
        await pkg.save();
    }
    const session = await openSession(root);
    await syncAll(session, options.binaryPath);
    let installNote = '';
    if (options.install && runner !== 'none') {
        const command =
            runner === 'mise'
                ? ['mise', 'install']
                : runner === 'uv'
                  ? ['uv', 'sync', '--group', 'gspot']
                  : [runner, 'install'];
        if (runner === 'mise') await run(['mise', 'trust', '.config/mise/conf.d/gspot.toml'], { cwd: root });
        const result = await run(command, { cwd: root });
        installNote =
            result.code === 0
                ? `ran ${command.join(' ')}`
                : `${command.join(' ')} failed (exit ${result.code}); gspot doctor names what is missing`;
    } else if (runner !== 'none')
        installNote = `install skipped; run: ${runner === 'mise' ? 'mise install' : `${runner} install`}`;
    const fresh = await openSession(root);
    const outcome = await executeRun(fresh, {
        stage: 'all',
        skips: [],
        localSkips: fresh.loaded.local.skip,
        fix: false,
        dryRun: false,
        noCache: true,
    });
    const findings = outcome.record.checks.flatMap((check) => check.findings);
    const allowed = new Set(
        fresh.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) =>
                manifest.checks.filter((check) => baselineAllowed(check.inspection)).map((check) => check.id),
            ),
        ),
    );
    const written = writeBaselines(
        root,
        findings,
        (check) => allowed.has(check) || fresh.loaded.policy.checks.some((entry) => entry.id === check),
    );
    const mkdir = join(root, '.gspot', 'baseline');
    if (written.length > 0) mkdirSync(mkdir, { recursive: true });
    const { dim } = paint();
    const lines = ['', `written: gspot.toml, .gspot/ (${outcome.record.checks.length} checks ran)`];
    if (installNote) lines.push(installNote);
    lines.push(
        written.length === 0
            ? 'baseline: every check passes; none needed'
            : `baseline: ${written.length} rule${written.length === 1 ? '' : 's'} enter a baseline with ${written.reduce((sum, file) => sum + file.count, 0)} findings; every other check passes`,
    );
    const failing = outcome.record.checks.filter((check) => check.status === 'missing' || check.status === 'error');
    for (const check of failing) lines.push(`${check.id}: ${check.note ?? check.status}`);
    const newer = await newerVersion(GSPOT_VERSION);
    lines.push(dim(newer ? `gspot ${newer} is available: gspot upgrade --check` : `gspot ${GSPOT_VERSION}`), '');
    note('run gspot check to see the gate; gspot doctor for what it could not check');
    return {
        text: lines.join('\n'),
        json: {
            root,
            plan,
            policy: policyText,
            baselines: written,
            install: installNote,
            checks: outcome.record.checks.map((check) => ({
                id: check.id,
                status: check.status,
                findings: check.findings.length,
            })),
        },
        exitCode: failing.length > 0 ? 1 : 0,
    };
}
