// One session per command: the policy, the manifests, the repository, the selection, and the merged view per scope.
import { posix } from 'node:path';
import { readPolicy } from '#cli/policy/read.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { npmPins } from '#cli/configurations/pins.ts';
import { readRepository } from '#cli/repository/read.ts';
import { scopeView } from '#cli/policy/settings/view.ts';
import { createReadCache } from '#cli/platform/source.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { getOwnership } from '#cli/lifecycle/ownership/log.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { acquirePythonInstaller } from '#cli/tools/python/uv.ts';
import { RUNNING_VERSION } from '#cli/config/platform/runtime.ts';
import { applicableManifests } from '#cli/planning/requirements.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { detectConfigurations } from '#cli/configurations/detect.ts';
import { XCODE_PROJECT_FILE } from '#cli/config/checks/tool/xcode.ts';
import { fileDeclarations } from '#cli/configurations/declarations.ts';
import { FILE_PREFIX_BYTES } from '#cli/config/repository/inventory.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import { selectPackageInstaller, inspectPackageInstaller } from '#cli/tools/npm/client.ts';
import type { PackageInstaller, PackageInstallerIdentity } from '#cli/types/parsers/packages.ts';

// Resolves every scope: its selected configurations, settings surface, and merged view.
function scopeSelections(policy: Policy, repository: Repository, manifests: Map<string, Manifest>): ScopeSelection[] {
    const { files, scopes } = repository;
    const automatic = detectConfigurations(files, manifests, []).flatMap(({ configuration, kind }) =>
        kind === 'general' && (manifests.get(configuration)?.configuration.when?.git !== true || repository.hasGit)
            ? [configuration]
            : [],
    );
    const effective = { ...policy, configurations: [...new Set([...policy.configurations, ...automatic])] };
    return scopes.map((scope) => {
        const selected = selectForScope(effective, scope.path, manifests);
        const surface = knownSettings(selected, policy.level);
        const declared = surface.defaults.get('swift.xcode_project');
        if (declared !== undefined) {
            const project = files.find(
                (file) => file.path.endsWith(XCODE_PROJECT_FILE) && scopeOf(file.path, scopes).path === scope.path,
            );
            surface.defaults.set('swift.xcode_project', {
                ...declared,
                value: project === undefined ? '' : posix.relative(scope.path, posix.dirname(project.path)),
            });
        }
        const view = scopeView(surface, effective, selected, scope.path);
        return { scope, selected, surface, view };
    });
}

/**
 * Opens a repository session. Throws GspotError (policy or selection) when gspot.toml or configuration selection is invalid.
 * @param rootPath the repository root
 * @param policyFiles the policy as read, read here by default
 * @returns the session
 */
export async function openSession(rootPath: string, policyFiles = readPolicy(rootPath)): Promise<ToolSession> {
    const reads = createReadCache(rootPath);
    const root = reads.root;
    const manifests = configurationManifests();
    const policy = { ...policyFiles.policy };
    const selected = new Map(
        ['', ...Object.keys(policy.scope)].map((path) => [path, selectForScope(policy, path, manifests)]),
    );
    policy.declarations = fileDeclarations(policy.declarations, selected);
    const repository = await readRepository(
        root,
        policy.declarations,
        Object.entries(policy.scope).map(([path, scope]) => ({ path, configurations: scope.configurations })),
        policy.exclude,
        reads,
    );
    // Init plans native configuration before the policy becomes a tracked file.
    if (!repository.files.some((file) => file.path === POLICY_FILE) && !pathMatcher(policy.exclude)(POLICY_FILE)) {
        const bytes = Buffer.from(policyFiles.text);
        repository.files.push({
            path: POLICY_FILE,
            prefix: bytes.subarray(0, FILE_PREFIX_BYTES),
            kind: 'source',
            kindSource: 'policy',
            tags: [],
            executable: false,
            size: bytes.length,
        });
    }
    const scopes = scopeSelections(policy, repository, manifests);
    let resolved: PackageInstaller | undefined;
    let resolvedPython: Promise<string> | undefined;
    const session: ToolSession = {
        pythonInstaller: (cancelSignal) => {
            resolvedPython ??= acquirePythonInstaller(root, policy.runner, cancelSignal);
            return resolvedPython;
        },
        packageInstaller() {
            if (installer === undefined) return undefined;
            resolved ??= inspectPackageInstaller(root, installer);
            return resolved;
        },
        root,
        version: RUNNING_VERSION,
        policyFiles: { ...policyFiles, policy },
        manifests,
        repository,
        scopes,
        inspections: new Map(),
        getPendingInstallations: (path) => getOwnership(path).installing,
        reads,
    };
    const installer: PackageInstallerIdentity | undefined =
        Object.keys(npmPins(applicableManifests(session), policy.runner)).length > 0
            ? await selectPackageInstaller(
                  root,
                  repository.files.filter((file) => file.kind === 'source').map((file) => file.path),
              )
            : undefined;
    return session;
}
