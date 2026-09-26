// Which planned checks may reuse a stored result, the key that identifies one, and how a result is stored.
import { probeTool } from '#cli/tools/probe.ts';
import { isAbsolute, join, relative, sep } from 'node:path';
import type { CheckResult } from '#cli/types/checks/checks.ts';
import { prepareCommand } from '#cli/execution/tool-runner.ts';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { commandConfigurations } from '#cli/execution/command-expansion.ts';
import type { RunHashes, PlannedCheck, Session } from '#cli/types/execution/execution.ts';
import { cacheInputs, cacheKey, fileHash, readCached, textHash, writeCached } from '#cli/execution/cache.ts';

const RAN_STATUSES = new Set(['ok', 'cache', 'fail']);

// The path a tool is recorded under: inside the cache root when it lies inside the repository.
function identityPath(session: Session, path: string): string {
    const local = relative(session.root, path);
    const isInside = !isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`);
    return session.cacheRoot !== undefined && isInside ? join(session.cacheRoot, local) : path;
}

// The identity of an executable: its recorded path, mode, and content hash, read once per run.
function toolIdentity(session: Session, path: string, hashes: RunHashes): string {
    const held = hashes.tools.get(path);
    if (held !== undefined) return held;
    const identity = JSON.stringify({
        path: identityPath(session, path),
        mode: statSync(path).mode,
        hash: new Bun.CryptoHasher('sha256').update(readFileSync(path)).digest('hex'),
    });
    hashes.tools.set(path, identity);
    return identity;
}

// The version fact of the tool a check runs, or the probe that found none.
function toolVersionOf(session: Session, planned: PlannedCheck, hashes: RunHashes): string {
    if (!planned.tool) return 'engine';
    const { env, cwd } = prepareCommand(session, planned, planned.spec.command ?? []);
    const probe = probeTool({ ...session, cwd }, { ...planned.tool, env });
    if (probe.path === undefined) return JSON.stringify(probe);
    const identity = toolIdentity(session, realpathSync(probe.path), hashes);
    return JSON.stringify([planned.tool.name, probe.state, probe.found, identity]);
}

// The hash of a repository file, read once per run.
function observedHash(session: Session, path: string, hashes: RunHashes): string {
    const held = hashes.files.get(path);
    if (held !== undefined) return held;
    const hash = fileHash(session.root, path, session.observations);
    hashes.files.set(path, hash);
    return hash;
}

// The hashes of the configuration files the check's command names, with a missing file recorded as such.
function configurationHashes(session: Session, planned: PlannedCheck, hashes: RunHashes): string {
    const entries = commandConfigurations(session, planned).map((path) => {
        try {
            return { path, hash: observedHash(session, path, hashes) };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            return { path, hash: 'missing' };
        }
    });
    return JSON.stringify(entries);
}

// The inputs a policy check declares, which alone authorize caching a check the repository selects by path.
function declaredInputs(session: Session, planned: PlannedCheck): string[] | undefined {
    if (planned.manifest !== undefined) return undefined;
    return session.policyFiles.policy.checks.find((entry) => entry.name === planned.check)?.inputs;
}

// Whether a check reads only what its key records: a command unless its manifest says cached = false, an
// analysis only when its manifest says cached = true, and never a check that needs a build, a daemon, or the network.
function isCacheable(planned: PlannedCheck): boolean {
    const { spec } = planned;
    const isAnalysis = spec.engine !== undefined || spec.analysis !== undefined;
    const isCached = isAnalysis ? spec.cached === true : spec.cached !== false;
    if (!isCached) return false;
    if (spec.requires !== undefined) return false;
    return spec.runs === 'per-file-list' || planned.files.length > 0;
}

// The paths whose content the key records: the check's files and its declared inputs, sorted.
function keyedPaths(session: Session, planned: PlannedCheck, declared: string[] | undefined): string[] {
    const inputs = declared === undefined ? [] : cacheInputs(session.root, declared);
    const paths = new Set([...planned.files.map((file) => file.path), ...inputs]);
    return [...paths].toSorted((left, right) => left.localeCompare(right));
}

// A result with the repository root rewritten to the cache root in its command, so the record stays portable.
function portableResult(session: Session, result: CheckResult): CheckResult {
    const { cacheRoot } = session;
    if (cacheRoot === undefined || result.command === undefined) return result;
    const command = result.command.map((part) => part.replaceAll(session.root, () => cacheRoot));
    return { ...result, command };
}

/**
 * The observations one execution pass shares between its cached checks.
 * @param session the session whose policy text seeds the configuration hash
 * @returns empty file and tool tables under the policy hash
 */
export function runHashes(session: Session): RunHashes {
    const policy = textHash(session.policyFiles.text);
    const files = new Map<string, string>();
    return { policy, files, tools: new Map<string, string>() };
}

/**
 * The cache key of a planned check, or undefined when its result must not be reused.
 * @param session the session
 * @param planned the check
 * @param hashes the observations shared by this pass
 * @returns the key
 */
export function cacheKeyFor(session: Session, planned: PlannedCheck, hashes: RunHashes): string | undefined {
    const declared = declaredInputs(session, planned);
    if (planned.manifest === undefined && declared === undefined) return undefined;
    if (!isCacheable(planned)) return undefined;
    const files = keyedPaths(session, planned, declared).map((path) => ({
        path,
        hash: observedHash(session, path, hashes),
    }));
    return cacheKey({
        check: planned.check,
        scope: planned.scope.scope.path,
        toolVersion: toolVersionOf(session, planned, hashes),
        configurationHash: hashes.policy,
        files,
        extra: `${session.version}\n${configurationHashes(session, planned, hashes)}`,
    });
}

/**
 * The stored result under a key, marked as served from the cache.
 * @param session the session
 * @param key the cache key
 * @param planned the check the result answers for
 * @returns the result, or undefined when nothing is stored
 */
export function cachedResult(session: Session, key: string, planned: PlannedCheck): CheckResult | undefined {
    const cached = readCached(session.cacheRoot ?? session.root, key);
    if (!cached) return undefined;
    const status = cached.status === 'ok' ? 'cache' : cached.status;
    return { ...cached, status, check: planned.check, scope: planned.scope.scope.path };
}

/**
 * Stores a result that ran to completion under its key.
 * @param session the session
 * @param key the cache key
 * @param result the result
 */
export function storeResult(session: Session, key: string, result: CheckResult): void {
    if (!RAN_STATUSES.has(result.status)) return;
    const stored = portableResult(session, result);
    writeCached(session.cacheRoot ?? session.root, key, stored);
}
