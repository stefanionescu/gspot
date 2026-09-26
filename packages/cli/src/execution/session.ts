import { npmPins } from '#cli/tools/pins.ts';
import type { PolicyFiles } from '#cli/policy/read.ts';
import type { ToolContext } from '#cli/tools/probe.ts';
import { readRepository } from '#cli/repository/tree.ts';
import type { Repository } from '#cli/repository/tree.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import packageManifest from '#package' with { type: 'json' };
// One session per command: the policy, the manifests, the repository, the selection and the merged view per scope.
import type { Manifest } from '#cli/configurations/manifests.ts';
import { toolPackageManager } from '#cli/tools/packages/manager.ts';
import type { SourceObservations } from '#cli/repository/tracked.ts';
import { readPolicy, assertPolicyComplete  } from '#cli/policy/read.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { resolveScopes, type ScopeSelection } from '#cli/policy/resolve.ts';

const { version: GSPOT_VERSION } = packageManifest;

/**
 * Opens a session on a repository that has gspot.toml. Throws PolicyError or SelectionError.
 * @param root the repository root
 * @param policyFiles
 * @returns the session
 */
export async function openSession(root: string, policyFiles: PolicyFiles = readPolicy(root)): Promise<Session> {
    assertPolicyComplete(policyFiles);
    const manifests = configurationManifests();
    const repo = await readRepository(
        root,
        policyFiles.policy.declarations,
        policyFiles.policy.scopes,
        policyFiles.policy.exclude,
        new Set(
            readOwnership(root)
                .files.filter((entry) => entry.kind === 'runtime')
                .map((entry) => entry.path),
        ),
    );
    const scopes = resolveScopes(policyFiles.policy, repo.scopes, manifests);
    const runner = policyFiles.policy.runner?.tool;
    const needsPackages =
        Object.keys(
            npmPins(
                scopes.flatMap((scope) => scope.selected),
                runner,
            ),
        ).length > 0;
    const packageManager = needsPackages
        ? await toolPackageManager(
              root,
              repo.files.filter((file) => file.nature === 'source').map((file) => file.path),
          )
        : undefined;
    return {
        ...(packageManager === undefined ? {} : { packageManager }),
        root,
        version: GSPOT_VERSION,
        policyFiles,
        manifests,
        repository: repo,
        scopes,
        probes: new Map(),
        observations: { root, sources: new Map() },
    };
}

export type Session = ToolContext & {
    observations: SourceObservations;
    /** Persistent result storage for a disposable revision snapshot. */
    cacheRoot?: string;
    resources?: DisposableStack;
    packageManager?: import('zod').infer<typeof import('#cli/tools/packages/manager.ts').packageManagerSchema>;
    cancelSignal?: AbortSignal;
    version: string;
    policyFiles: PolicyFiles;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
};
