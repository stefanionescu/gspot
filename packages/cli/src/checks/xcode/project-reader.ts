import { z } from 'zod';
import { posix } from 'node:path';
import type { Folder, Plist, ProjectObject, Token, XcodeProject } from '#cli/types/checks/xcode.ts';
import { BUILD_SETTING, PBXPROJ_ESCAPES, PBXPROJ_PUNCTUATION, WORD_CHARACTER } from '#cli/constants/checks/xcode.ts';

const objectSchema = z.object({
    isa: z.string(),
    name: z.string().optional(),
    path: z.string().optional(),
    sourceTree: z.string().optional(),
    children: z.array(z.string()).optional(),
    fileRef: z.string().optional(),
    files: z.array(z.string()).optional(),
    buildPhases: z.array(z.string()).optional(),
    fileSystemSynchronizedGroups: z.array(z.string()).optional(),
    exceptions: z.array(z.string()).optional(),
    membershipExceptions: z.array(z.string()).optional(),
    target: z.string().optional(),
    productType: z.string().optional(),
    mainGroup: z.string().optional(),
    targets: z.array(z.string()).optional(),
    projectDirPath: z.string().optional(),
});
// The index past the quoted text that opens before from, where a backslash escapes the next character, or -1.
function quotedEnd(text: string, from: number): number {
    for (let at = from; at < text.length; at += 1) {
        if (text[at] === '\\') at += 1;
        else if (text[at] === '"') return at + 1;
    }
    return -1;
}

// The text a quoted token stands for, with its escapes resolved.
function unescaped(body: string): string {
    return body.replaceAll(/\\(U[0-9a-fA-F]{4}|[0-7]{1,3}|[\s\S])/gu, (_whole, escaped: string) => {
        if (escaped.startsWith('U')) return String.fromCodePoint(Number.parseInt(escaped.slice(1), 16));
        if (/^[0-7]/u.test(escaped)) return String.fromCodePoint(Number.parseInt(escaped, 8));
        return PBXPROJ_ESCAPES[escaped] ?? escaped;
    });
}

// The index past the whitespace or comment at at, or at when a token starts there.
function skippedEnd(text: string, at: number): number {
    const char = text[at] ?? '';
    if (/\s/u.test(char)) return at + 1;
    if (char !== '/') return at;
    if (text[at + 1] === '/') {
        const end = text.indexOf('\n', at);
        return end === -1 ? text.length : end + 1;
    }
    if (text[at + 1] !== '*') return at;
    const end = text.indexOf('*/', at + 2);
    if (end === -1) throw new Error(`Invalid Xcode project syntax at character ${String(at + 1)}.`);
    return end + 2;
}

// The quoted text, punctuation, or word at at, with the index past it.
function tokenAt(text: string, at: number): { token: Token; end: number } {
    const char = text[at] ?? '';
    if (char === '"') {
        const end = quotedEnd(text, at + 1);
        if (end === -1) throw new Error(`Invalid Xcode project syntax at character ${String(at + 1)}.`);
        return { token: { text: unescaped(text.slice(at + 1, end - 1)), quoted: true, at }, end };
    }
    if (PBXPROJ_PUNCTUATION.has(char)) return { token: { text: char, quoted: false, at }, end: at + 1 };
    let end = at;
    while (WORD_CHARACTER.test(text[end] ?? '')) end += 1;
    if (end === at) throw new Error(`Invalid Xcode project syntax at character ${String(at + 1)}.`);
    return { token: { text: text.slice(at, end), quoted: false, at }, end };
}

function tokens(text: string): Token[] {
    const result: Token[] = [];
    let at = 0;
    while (at < text.length) {
        const skipped = skippedEnd(text, at);
        if (skipped > at) {
            at = skipped;
            continue;
        }
        const scanned = tokenAt(text, at);
        result.push(scanned.token);
        at = scanned.end;
    }
    return result;
}

function parse(text: string): Plist {
    const input = tokens(text);
    let at = 0;
    const is = (value: string): boolean => input[at]?.quoted === false && input[at]?.text === value;
    const take = (value: string): void => {
        if (!is(value))
            throw new Error(
                `Expected ${value} in Xcode project at character ${String((input[at]?.at ?? text.length) + 1)}.`,
            );
        at += 1;
    };
    const dictionary = (): Plist => {
        take('{');
        const entries = new Map<string, Plist>();
        while (!is('}')) {
            const key = value();
            if (typeof key !== 'string') throw new Error('An Xcode project dictionary key must be text.');
            take('=');
            if (entries.has(key)) throw new Error(`Duplicate Xcode project key: ${key}.`);
            entries.set(key, value());
            take(';');
        }
        take('}');
        return Object.fromEntries(entries);
    };
    const list = (): Plist => {
        take('(');
        const entries: Plist[] = [];
        while (!is(')')) {
            entries.push(value());
            if (is(')')) break;
            take(',');
        }
        take(')');
        return entries;
    };
    const scalar = (): Plist => {
        const token = input[at++];
        if (token === undefined || (!token.quoted && /^[{}()=;,]$/u.test(token.text)))
            throw new Error('Expected a value in the Xcode project.');
        return token.text;
    };
    const value = (): Plist => {
        if (is('{')) return dictionary();
        if (is('(')) return list();
        return scalar();
    };
    const result = value();
    if (at !== input.length) throw new Error('Unexpected content after the Xcode project dictionary.');
    return result;
}

// The object an id names, which must exist.
function objectOf(project: Pick<XcodeProject, 'objects'>, id: string): ProjectObject {
    const found = project.objects[id];
    if (found === undefined) throw new Error(`The Xcode project references an unknown object: ${id}.`);
    return found;
}

// The group each object is a child of, refusing an object two groups claim.
function parentGroups(objects: Record<string, ProjectObject>): Map<string, string> {
    const parents = new Map<string, string>();
    for (const [id, entry] of Object.entries(objects))
        for (const child of entry.children ?? []) {
            if (parents.has(child))
                throw new Error(`The Xcode project gives an object multiple parent groups: ${child}.`);
            parents.set(child, id);
        }
    return parents;
}

// The folder a group-relative object is resolved against: the project folder for the main group, else its parent's.
function groupBase(project: XcodeProject, id: string): string {
    if (id === project.root.mainGroup) return posix.join(project.directory, project.root.projectDirPath ?? '');
    const parent = project.parents.get(id);
    if (parent === undefined) throw new Error(`The Xcode project has no parent group for ${id}.`);
    return resolvePath(project, parent);
}

// The folder an object's source tree starts from.
function treeBase(project: XcodeProject, id: string, tree: string): string {
    if (tree === 'SOURCE_ROOT') return project.directory;
    if (tree === '<absolute>') return '/';
    if (tree === '<group>') return groupBase(project, id);
    throw new Error(`Cannot resolve Xcode source tree ${tree} without build settings.`);
}

// The repository-relative path of an object, following its groups up to the main group.
function resolvePath(project: XcodeProject, id: string): string {
    if (project.visiting.has(id)) throw new Error('The Xcode project contains a group cycle.');
    project.visiting.add(id);
    const entry = objectOf(project, id);
    const base = treeBase(project, id, entry.sourceTree ?? '<group>');
    const path = entry.path ?? '';
    if (BUILD_SETTING.test(path)) throw new Error(`Cannot resolve Xcode source path ${path} without build settings.`);
    project.visiting.delete(id);
    return posix.normalize(posix.isAbsolute(path) ? path : posix.join(base, path));
}

// The Swift files a target compiles, from its sources build phases.
function targetSources(project: XcodeProject, target: ProjectObject): string[] {
    const phases = (target.buildPhases ?? []).map((phaseId) => objectOf(project, phaseId));
    return phases
        .filter((phase) => phase.isa === 'PBXSourcesBuildPhase')
        .flatMap((phase) => phase.files ?? [])
        .flatMap((buildId) => {
            const build = objectOf(project, buildId);
            if (build.fileRef === undefined) throw new Error('An Xcode source build entry has no file reference.');
            const file = objectOf(project, build.fileRef);
            return file.path?.endsWith('.swift') === true ? [resolvePath(project, build.fileRef)] : [];
        });
}

// The synchronized folders a target owns, each with the files its exceptions leave out.
function targetFolders(project: XcodeProject, id: string, target: ProjectObject): Folder[] {
    return (target.fileSystemSynchronizedGroups ?? []).map((groupId) => {
        const group = objectOf(project, groupId);
        const path = resolvePath(project, groupId);
        const exceptions = (group.exceptions ?? []).map((exceptionId) => objectOf(project, exceptionId));
        const excluded = exceptions
            .filter((exception) => exception.target === id)
            .flatMap((exception) => (exception.membershipExceptions ?? []).map((name) => posix.join(path, name)));
        return { path: `${path}/`, excluded: new Set(excluded) };
    });
}

export const projectSchema = z.object({ rootObject: z.string(), objects: z.record(z.string(), objectSchema) });

/**
 * Resolve the Swift sources and synchronized folders that belong to project targets.
 * @param text the project file text
 * @param directory the folder the project file lives in, relative to the repository root
 * @returns the source paths and the synchronized folders with their exclusions
 */
export function readProject(text: string, directory: string): { sources: Set<string>; folders: Folder[] } {
    const parsed = projectSchema.parse(parse(text));
    const root = objectOf(parsed, parsed.rootObject);
    if (root.isa !== 'PBXProject' || root.mainGroup === undefined)
        throw new Error('The Xcode project has no main group.');
    const project: XcodeProject = {
        objects: parsed.objects,
        root: { ...root, mainGroup: root.mainGroup },
        directory,
        parents: parentGroups(parsed.objects),
        visiting: new Set(),
    };
    const sources = new Set<string>();
    const folders: Folder[] = [];
    for (const id of root.targets ?? []) {
        const target = objectOf(project, id);
        if (target.isa !== 'PBXNativeTarget') continue;
        for (const source of targetSources(project, target)) sources.add(source);
        folders.push(...targetFolders(project, id, target));
    }
    return { sources, folders };
}

/**
 * Read test-target names without requiring source paths to resolve build settings.
 * @param text the project file text
 * @returns the names of the test targets
 */
export function projectTestTargets(text: string): string[] {
    const project = projectSchema.parse(parse(text));
    const root = project.objects[project.rootObject];
    if (root?.isa !== 'PBXProject') throw new Error('The Xcode project has no project root.');
    return (root.targets ?? []).flatMap((id) => {
        const target = project.objects[id];
        if (target === undefined) throw new Error(`The Xcode project references an unknown target: ${id}.`);
        if (!/^com\.apple\.product-type\.bundle\.(?:unit-test|ui-testing)$/u.test(target.productType ?? '')) return [];
        if (target.name === undefined) throw new Error('An Xcode test target has no name.');
        return [target.name];
    });
}
