import { resolvePythonProject } from '#cli/lifecycle/python-project.ts';
import { resolvePackageProject } from '#cli/lifecycle/package-project.ts';
import { isValePackageFile } from '#cli/repository/natures.ts';
// Write every generated file, block and merge; remove recorded strays. The apply command as a function.
import { computeDrift } from '#cli/emit/drift.ts';
import { parse as parseJsonc } from 'jsonc-parser';
import { generatedSnapshot, readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import type { FileProposal, FileSnapshot, LifecycleOwner } from '#cli/lifecycle/types.ts';
import { openSession } from '#cli/run/session.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { writePin, GSPOT_VERSION, pinnedVersion } from '#cli/run/version-pin.ts';
import type { Session, CommandResult } from '#cli/run/types.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { hasPackages, installPackages } from '#cli/prose/vale.ts';
import type { ApplyReport, ApplyOptions, DriftEntry, GeneratedProposal } from '#cli/emit/types.ts';

function configurationProposals(owner: LifecycleOwner, generated: GeneratedProposal, takeover: boolean) {
    const proposals: { proposal: FileProposal; package: boolean }[] = [];
    for (const merge of generated.merges) {
        const proposed = parseJsonc(merge.content) as Record<string, unknown>;
        proposals.push({
            package: false,
            proposal: owner.proposeConfiguration(
                merge.path,
                'json',
                merge.keys.map((key) => ({ path: [key], value: proposed[key] })),
                takeover,
            ),
        });
    }
    for (const output of generated.packages) {
        const fields = Object.entries(output.scripts).map(([name, value]) => ({ path: ['scripts', name], value }));
        proposals.push({ package: true, proposal: owner.proposeConfiguration(output.path, 'json', fields, true) });
    }
    if (generated.lefthook !== undefined) {
        const fields = Object.entries(generated.lefthook.block).flatMap(([hook, { commands }]) =>
            Object.entries(commands).map(([name, value]) => ({ path: [hook, 'commands', name], value })),
        );
        proposals.push({
            package: false,
            proposal: owner.proposeConfiguration(generated.lefthook.path, 'yaml', fields, true),
        });
    }
    return proposals;
}

function driftText(drift: DriftEntry[]): string {
    const noun = drift.length === 1 ? 'file' : 'files';
    const lines = [`${String(drift.length)} generated ${noun} drifted:`, ''];
    for (const entry of drift) {
        lines.push(`  ${entry.path}  ${entry.kind}`);
        if (entry.diff !== undefined && entry.diff !== '')
            lines.push(
                entry.diff
                    .split('\n')
                    .map((line) => `    ${line}`)
                    .join('\n'),
            );
    }
    lines.push(
        '',
        'Change policy in gspot.toml, then run gspot apply. Edited outputs are preserved; move them aside before regenerating.',
    );
    return `${lines.join('\n')}\n`;
}

function previewApply(session: Session): CommandResult {
    const proposal = emitAll(session);
    const drift = computeDrift(session, proposal);
    const summary = drift.length === 0 ? 'every generated file matches its proposal\n' : driftText(drift);
    const text = summary + proposal.notes.map((note) => `note     ${note}\n`).join('');
    const pin = { from: pinnedVersion(session.root), to: GSPOT_VERSION };
    return {
        text: `version ${pin.from ?? 'unpinned'} -> ${pin.to}\n${text}`,
        json: { isDryRun: true, pin, drift, notes: proposal.notes },
        exitCode: 0,
    };
}

async function installProsePackages(session: Session, report: ApplyReport): Promise<void> {
    const isProse = session.scopes.some((selection) =>
        selection.selected.some((manifest) => manifest.preset.name === 'prose'),
    );
    if (!isProse || hasPackages(session.root)) return;
    const problem = await installPackages(session.root);
    if (problem === undefined) report.notes.push('synced the Vale packages into .gspot/vale/styles');
    else report.notes.push(`the Vale packages are not synced (${problem}); run gspot apply with the network on`);
}

function reportText(report: ApplyReport): string {
    const lines = [
        ...report.written.map((path) => `wrote    ${path}`),
        ...report.blocks.map((path) => `block    ${path}`),
        ...report.packages.map((path) => `scripts  ${path}`),
        ...report.removed.map((path) => `removed  ${path}`),
        ...report.notes.map((note) => `note     ${note}`),
    ];
    if (lines.length === 0) lines.push(`everything up to date (${String(report.unchanged.length)} files)`);
    return `${lines.join('\n')}\n`;
}

// Both publication and pruning report preserved files through the same ownership result.
function recordPreserved(report: ApplyReport, proposals: FileProposal[]): void {
    const preserved = proposals.filter((proposal) => proposal.status === 'preserved');
    report.preserved.push(...preserved.map((proposal) => proposal.path));
    report.notes.push(...preserved.map((proposal) => `preserved edited or unowned ${proposal.path}`));
}

// Every proposal is prepared before the owner publishes the batch.
function publishGenerated(
    owner: LifecycleOwner,
    rendered: GeneratedProposal,
    report: ApplyReport,
    takeover?: ReadonlyMap<string, FileSnapshot>,
): string[] {
    const configurations = configurationProposals(owner, rendered, takeover !== undefined);
    const replacements = rendered.files.map((file) => {
        const kind = file.kind === 'lock' || file.kind === 'hook' ? file.kind : 'config';
        return owner.proposeReplacement(
            file.path,
            generatedSnapshot(file, owner.read(file.path)),
            kind,
            file.kind === 'lock' ? file.observed !== undefined : (takeover?.has(file.path) ?? false),
            file.kind === 'lock' ? file.observed : takeover?.get(file.path),
        );
    });
    const blocks = rendered.blocks.map((block) => owner.proposeBlock(block.path, block.block, block.style));
    const proposals = [...replacements, ...blocks, ...configurations.map(({ proposal }) => proposal)];
    const conflicts = proposals.filter((proposal) => proposal.status === 'preserved').map((proposal) => proposal.path);
    if (takeover !== undefined && conflicts.length > 0)
        throw new Error(
            `Setup preserved conflicting outputs: ${conflicts.join(', ')}. Move them aside and run gspot apply; old tool configuration was retained.`,
        );
    owner.applyProposals(proposals.filter((proposal) => proposal.status !== 'preserved'));
    recordPreserved(report, proposals);
    report.written.push(
        ...replacements.filter((proposal) => proposal.status === 'changed').map((proposal) => proposal.path),
    );
    report.unchanged.push(
        ...replacements.filter((proposal) => proposal.status === 'unchanged').map((proposal) => proposal.path),
    );
    report.blocks.push(...blocks.filter((proposal) => proposal.status === 'changed').map((proposal) => proposal.path));
    for (const { proposal, package: isPackage } of configurations) {
        if (proposal.status === 'changed') (isPackage ? report.packages : report.written).push(proposal.path);
    }
    return proposals.map((proposal) => proposal.path);
}

// Pruning restores only locally recorded outputs that no selected owner still needs.
function pruneGenerated(owner: LifecycleOwner, session: Session, expected: Set<string>, report: ApplyReport): void {
    const usesProse = session.scopes.some((scope) =>
        scope.selected.some((manifest) => manifest.preset.name === 'prose'),
    );
    const retained = new Set(
        readOwnership(session.root)
            .files.filter((entry) => entry.kind === 'hook' || entry.kind === 'runtime')
            .map((entry) => entry.path),
    );
    const pruning = owner
        .installedPaths()
        .filter(
            (path) =>
                !(
                    expected.has(path) ||
                    retained.has(path) ||
                    (usesProse && isValePackageFile(path)) ||
                    (session.packageManager !== undefined && path.startsWith('.gspot/node_modules/')) ||
                    (expected.has('.gspot/pyproject.toml') && path.startsWith('.gspot/.venv/'))
                ),
        )
        .map((path) => owner.proposeRestoration(path));
    recordPreserved(report, pruning);
    const accepted = pruning.filter((proposal) => proposal.status !== 'preserved');
    owner.applyProposals(accepted);
    report.removed.push(...accepted.map((proposal) => proposal.path));
}

/**
 * Apply generated proposals through the repository's lifecycle owner.
 * @param session the configuration and repository observations
 * @param takeover reviewed originals authorized for replacement
 * @returns generated changes and preserved files
 */
export async function applyAll(session: Session, takeover?: ReadonlyMap<string, FileSnapshot>): Promise<ApplyReport> {
    return withLifecycleOwner(session.root, async (owner) => {
        if (owner.read('gspot.toml')?.bytes.toString('utf8') !== session.policyFiles.text)
            throw new Error('The gspot.toml file changed after generation was planned. Retry the command.');
        const report: ApplyReport = {
            preserved: [],
            written: [],
            unchanged: [],
            removed: [],
            blocks: [],
            packages: [],
            notes: [],
        };
        const rendered = emitAll(session, takeover);
        await resolvePackageProject(session.root, rendered.files, owner);
        await resolvePythonProject(session.root, rendered.files, owner);
        if (owner.read('gspot.toml')?.bytes.toString('utf8') !== session.policyFiles.text)
            throw new Error('The gspot.toml file changed during tool resolution. Retry the command.');
        report.notes.push(...rendered.notes);
        const targets = publishGenerated(owner, rendered, report, takeover);
        pruneGenerated(owner, session, new Set(['gspot.toml', '.gspot/version', '.gitignore', ...targets]), report);
        await installProsePackages(session, report);
        const toolInputs = new Set(
            rendered.files
                .filter(
                    (file) =>
                        file.kind === 'lock' ||
                        file.path === '.gspot/package.json' ||
                        file.path === '.gspot/pyproject.toml',
                )
                .map((file) => file.path),
        );
        if (report.written.some((path) => toolInputs.has(path)))
            report.notes.push('Tool dependencies changed. Run: gspot install');
        if (report.preserved.length > 0)
            throw new Error(
                `Apply preserved edited outputs: ${report.preserved.join(', ')}. Resolve them and retry; the version pin was not changed.`,
            );
        writePin(session.root);
        return report;
    });
}

/**
 * Generates configuration or previews proposed changes without writing.
 * @param options the parsed flags
 * @returns the command result
 */
export async function applyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    if (options.isDryRun) return previewApply(session);
    const report = await applyAll(session);
    return { text: reportText(report), json: report, exitCode: 0 };
}
