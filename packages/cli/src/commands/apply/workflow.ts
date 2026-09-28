import type { Read } from '#cli/types/platform.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { assertNoProblems } from '#cli/policy/read.ts';
import { writeGenerated } from '#cli/lifecycle/apply.ts';
import { writePin } from '#cli/lifecycle/version-pin.ts';
import type { Generated } from '#cli/types/generation.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import { preparePythonProject } from '#cli/tools/python-project.ts';
import { CONFLICT_MARKERS } from '#cli/config/lifecycle/lifecycle.ts';
import { runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import { installPackages, hasOwnedPackages } from '#cli/tools/vale.ts';
import { preparePackageProject } from '#cli/tools/packages/project.ts';
import type { Owner, ApplyReport } from '#cli/types/lifecycle/lifecycle.ts';

async function installProsePackages(session: Session, report: ApplyReport): Promise<void> {
    const isProse = session.scopes.some((selection) =>
        selection.selected.some((manifest) => manifest.kit.name === 'prose'),
    );
    if (!isProse || hasOwnedPackages(session.root)) return;
    const problem = await installPackages(session.root);
    if (problem === undefined) report.notes.push('synced the Vale packages into .gspot/config/vale/styles');
    else report.notes.push(`the Vale packages are not synced (${problem}); run gspot apply with the network on`);
}

// A generated file a merge left with conflict markers is no edit anyone keeps: apply writes it again (K-274).
function conflictedOutputs(owner: Owner, rendered: Generated): Map<string, Read> {
    const conflicted = new Map<string, Read>();
    for (const file of rendered.files) {
        const current = owner.read(file.path);
        if (current !== undefined && CONFLICT_MARKERS.test(current.bytes.toString('utf8')))
            conflicted.set(file.path, current);
    }
    return conflicted;
}

/**
 * Apply generated plans through the repository's lifecycle owner.
 * @param session the configuration and repository reads
 * @param replace reviewed originals authorized for replacement
 * @returns generated changes and preserved files
 */
export async function applyAll(session: Session, replace?: ReadonlyMap<string, Read>): Promise<ApplyReport> {
    // Generation requires a valid policy. Refuse errors before writing proposed files.
    assertNoProblems(session.policyFiles);
    return runOwnedLifecycle(session.root, async (owner) => {
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
        const rendered = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
            replace: replace,
        });
        await preparePackageProject(session.root, rendered.files, owner);
        await preparePythonProject(session.root, rendered.files, owner);
        if (owner.read('gspot.toml')?.bytes.toString('utf8') !== session.policyFiles.text)
            throw new Error('The gspot.toml file changed during tool resolution. Retry the command.');
        report.notes.push(...rendered.notes);
        writeGenerated(owner, {
            root: session.root,
            rendered,
            report,
            retained: {
                prose: session.scopes.some((scope) => scope.selected.some((manifest) => manifest.kit.name === 'prose')),
                packages: session.packageClient !== undefined,
            },
            replace,
            regenerate: conflictedOutputs(owner, rendered),
        });
        await installProsePackages(session, report);
        const toolInputs = new Set(
            rendered.files
                .filter(
                    (file) =>
                        file.kind === 'lock' || ['.gspot/package.json', '.gspot/pyproject.toml'].includes(file.path),
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
