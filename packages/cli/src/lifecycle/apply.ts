// Write every generated file, block and merge; remove recorded strays. The apply command as a function.
import { emitAll } from '#cli/emit/targets.ts';
import { parse as parseJsonc } from 'jsonc-parser';
import { writePin } from '#cli/run/version-pin.ts';
import type { Session } from '#cli/types/execution.ts';
import type { FileSnapshot } from '#cli/types/filesystem.ts';
import { hasPackages, installPackages } from '#cli/prose/vale.ts';
import { resolvePythonProject } from '#cli/tools/python-project.ts';
import { resolvePackageProject } from '#cli/tools/package-project.ts';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import type { FileProposal, LifecycleOwner } from '#cli/types/ownership.ts';
import type { ApplyReport, GeneratedProposal } from '#cli/types/generation.ts';
import { generatedSnapshot, readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership.ts';

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
    for (const output of generated.configurations) {
        proposals.push({
            package: output.path === 'package.json',
            proposal: owner.proposeConfiguration(output.path, output.format, output.changes, true),
        });
    }
    return proposals;
}

async function installProsePackages(session: Session, report: ApplyReport): Promise<void> {
    const isProse = session.scopes.some((selection) =>
        selection.selected.some((manifest) => manifest.configuration.name === 'prose'),
    );
    if (!isProse || hasPackages(session.root, true)) return;
    const problem = await installPackages(session.root);
    if (problem === undefined) report.notes.push('synced the Vale packages into .gspot/config/vale/styles');
    else report.notes.push(`the Vale packages are not synced (${problem}); run gspot apply with the network on`);
}

// Both publication and pruning report preserved files through the same ownership result.
function recordPreserved(report: ApplyReport, proposals: FileProposal[]): void {
    const preserved = proposals.filter((proposal) => proposal.status === 'preserved');
    report.preserved.push(...preserved.map((proposal) => proposal.path));
    for (const proposal of preserved) {
        report.notes.push(`preserved edited or unowned ${proposal.path}`);
        if (proposal.previous?.original !== undefined)
            report.notes.push(`original for ${proposal.path} retained at ${proposal.previous.original.backup}`);
    }
}

// Every proposal is prepared before the owner publishes the batch.
function publishGenerated(
    owner: LifecycleOwner,
    session: Session,
    rendered: GeneratedProposal,
    report: ApplyReport,
    takeover?: ReadonlyMap<string, FileSnapshot>,
): void {
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
    const generated = [...replacements, ...blocks, ...configurations.map(({ proposal }) => proposal)];
    const expected = new Set(['gspot.toml', '.gspot/version', '.gitignore', ...generated.map(({ path }) => path)]);
    const pruning = pruningProposals(owner, session, expected);
    const proposals = [...generated, ...pruning];
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
    report.removed.push(...pruning.filter((proposal) => proposal.status !== 'preserved').map(({ path }) => path));
}

// Pruning restores only locally recorded outputs that no selected owner still needs.
function pruningProposals(owner: LifecycleOwner, session: Session, expected: Set<string>): FileProposal[] {
    const usesProse = session.scopes.some((scope) =>
        scope.selected.some((manifest) => manifest.configuration.name === 'prose'),
    );
    const retained = new Set(
        readOwnership(session.root)
            .files.filter((entry) => entry.kind === 'hook' || entry.kind === 'runtime' || entry.kind === 'export')
            .map((entry) => entry.path),
    );
    return owner
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
        publishGenerated(owner, session, rendered, report, takeover);
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
                `Apply preserved edited outputs: ${report.preserved.join(', ')}. ${report.notes.join('. ')}. Resolve them and retry; the version pin was not changed.`,
            );
        writePin(session.root);
        return report;
    });
}
