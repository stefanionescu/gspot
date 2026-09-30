// Read a profile from a path, an https URL or github:owner/repo, validate it, and name every problem in one pass.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse as parseToml } from 'smol-toml';
import { similar } from '#cli/policy/similar.ts';
import * as messages from '#cli/policy/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import type { Profile } from '#cli/types/policy/profiles.ts';
import { profileSchema, isRepositoryPath } from '#cli/policy/profiles/schema.ts';
import { RAW_HOST, PROFILE_FILE, GITHUB_PREFIX, REQUEST_TIMEOUT_MS } from '#cli/config/policy/profiles.ts';

function githubUrl(reference: string): string {
    const [location = '', ref = 'HEAD'] = reference.slice(GITHUB_PREFIX.length).split('@');
    const [owner = '', repository = '', ...rest] = location.split('/');
    const file = rest.length === 0 ? PROFILE_FILE : rest.join('/');
    return `${RAW_HOST}/${owner}/${repository}/${ref}/${file}`;
}

async function fetched(url: string): Promise<string> {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new GspotError('profile', [`The profile at ${url} answered ${String(response.status)}.`]);
    return response.text();
}

async function profileText(source: string, cwd: string): Promise<string> {
    if (source.startsWith(GITHUB_PREFIX)) return fetched(githubUrl(source));
    if (source.startsWith('https://')) return fetched(source);
    if (source.startsWith('http://')) throw new GspotError('profile', ['A profile is fetched over https, not http.']);
    const path = resolve(cwd, source);
    try {
        return readFileSync(path, 'utf8');
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            throw new GspotError('profile', [`There is no profile at ${source}.`]);
        throw error;
    }
}

// A path belongs to one repository, so an entry that names one cannot travel.
function pathProblems(value: unknown, where: string): string[] {
    if (Array.isArray(value)) return value.flatMap((item, index) => pathProblems(item, `${where}[${String(index)}]`));
    if (typeof value !== 'object' || value === null) return [];
    return Object.entries(value).flatMap(([key, inner]) => {
        if (isRepositoryPath(key, inner))
            return [`${where} holds \`${key}\`, which names a path of one repository; a profile carries no path.`];
        const below = where === '' ? key : `${where}.${key}`;
        return pathProblems(inner, below);
    });
}

/**
 * Parses and validates the text of a profile. Throws ProfileError with every problem found.
 * @param text the TOML text
 * @param source where it came from, for messages
 * @returns the profile with the SHA-256 of its text
 */
export function parseProfile(text: string, source: string): Profile {
    let raw: unknown;
    try {
        raw = parseToml(text);
    } catch (error) {
        throw new GspotError('profile', [messages.tomlSyntax(source, (error as Error).message)]);
    }
    const result = profileSchema.safeParse(raw);
    const shape = result.success
        ? []
        : result.error.issues.map((issue) => {
              const where = issue.path.map(String).join('.');
              return `${where === '' ? source : where}: ${issue.message}`;
          });
    const named = (raw as { kits?: unknown }).kits;
    const known = kitManifests().keys().toArray();
    const configurations = (Array.isArray(named) ? named.map(String) : [])
        .filter((id) => !known.includes(id))
        .map((id) => messages.unknownKit(id, similar(id, known)));
    const problems = [...shape, ...configurations, ...pathProblems(raw, '')];
    if (!result.success || problems.length > 0) throw new GspotError('profile', problems);
    return { source, digest: createHash('sha256').update(text).digest('hex'), tables: result.data };
}

/**
 * Loads a profile from a path, an https URL or `github:owner/repo[/path][@ref]`.
 * @param source where the profile is
 * @param cwd the directory a relative path starts from
 * @returns the validated profile
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Init and the profile tests read a profile from a path or a URL through this one entry.
export async function readProfile(source: string, cwd: string): Promise<Profile> {
    return parseProfile(await profileText(source, cwd), source);
}
