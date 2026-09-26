// Read a profile from a path, an https URL or github:owner/repo, validate it, and name every problem in one pass.
import { resolve } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { readFileSync, statSync } from 'node:fs';
import { nearMatches } from '#cli/policy/near.ts';
import * as messages from '#cli/policy/messages.ts';
import type { ProfileTables } from '#cli/policy/profiles/schema.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { isRepositoryPath, profileSchema } from '#cli/policy/profiles/schema.ts';

const GITHUB_PREFIX = 'github:';
const RAW_HOST = 'https://raw.githubusercontent.com';
const PROFILE_FILE = 'gspot.profile.toml';
const REQUEST_TIMEOUT_MS = 10_000;

function githubUrl(reference: string): string {
    const [location = '', ref = 'HEAD'] = reference.slice(GITHUB_PREFIX.length).split('@', 2);
    const [owner = '', repository = '', ...rest] = location.split('/');
    const file = rest.length === 0 ? PROFILE_FILE : rest.join('/');
    return `${RAW_HOST}/${owner}/${repository}/${ref}/${file}`;
}

async function fetched(url: string): Promise<string> {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new ProfileError([`The profile at ${url} answered ${String(response.status)}.`]);
    return response.text();
}

async function profileText(source: string, cwd: string): Promise<string> {
    if (source.startsWith(GITHUB_PREFIX)) return fetched(githubUrl(source));
    if (source.startsWith('https://')) return fetched(source);
    if (source.startsWith('http://')) throw new ProfileError(['A profile is fetched over https, not http.']);
    const path = resolve(cwd, source);
    if (statSync(path, { throwIfNoEntry: false }) === undefined)
        throw new ProfileError([`There is no profile at ${source}.`]);
    return readFileSync(path, 'utf8');
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

function issueLine(issue: { path: PropertyKey[]; message: string }, source: string): string {
    const where = issue.path.map(String).join('.');
    return `${where === '' ? source : where}: ${issue.message}`;
}

function configurationProblems(configurations: string[]): string[] {
    const known = configurationManifests().keys().toArray();
    return configurations
        .filter((id) => !known.includes(id))
        .map((id) => messages.unknownConfiguration(id, nearMatches(id, known)));
}

/** Every problem a profile has, as one error with one line per problem. */
export class ProfileError extends Error {
    readonly problems: string[];

    /**
     * Joins the problems into the message and keeps them as a list.
     * @param problems the problems in plain English
     */
    constructor(problems: string[]) {
        super(problems.join('\n'));
        this.name = 'ProfileError';
        this.problems = problems;
    }
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
        throw new ProfileError([messages.tomlSyntax(source, (error as Error).message)]);
    }
    const result = profileSchema.safeParse(raw);
    const shape = result.success ? [] : result.error.issues.map((issue) => issueLine(issue, source));
    const named = (raw as { configurations?: unknown }).configurations;
    const configurations = configurationProblems(Array.isArray(named) ? named.map(String) : []);
    const problems = [...shape, ...configurations, ...pathProblems(raw, '')];
    if (!result.success || problems.length > 0) throw new ProfileError(problems);
    return { source, digest: new Bun.CryptoHasher('sha256').update(text).digest('hex'), tables: result.data };
}

/**
 * Loads a profile from a path, an https URL or `github:owner/repo[/path][@ref]`.
 * @param source where the profile is
 * @param cwd the directory a relative path starts from
 * @returns the validated profile
 */
export async function readProfile(source: string, cwd: string): Promise<Profile> {
    return parseProfile(await profileText(source, cwd), source);
}

export type Profile = { source: string; digest: string; tables: ProfileTables };
