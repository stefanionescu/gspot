import { z } from 'zod';
import { posix } from 'node:path';

type Plist = string | Plist[] | { [key: string]: Plist };
type Token = { text: string; quoted: boolean; at: number };

const PUNCTUATION = new Set(['{', '}', '(', ')', '=', ';', ',']);
const WORD_CHARACTER = /[A-Za-z0-9_.$/+-]/u;
const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
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
const projectSchema = z.object({ rootObject: z.string(), objects: z.record(z.string(), objectSchema) });

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
        return ESCAPES[escaped] ?? escaped;
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
    if (PUNCTUATION.has(char)) return { token: { text: char, quoted: false, at }, end: at + 1 };
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

/**
 * Resolve the Swift sources and synchronized folders that belong to project targets.
 * @param text the project file text
 * @param directory the folder the project file lives in, relative to the repository root
 * @returns the source paths and the synchronized folders with their exclusions
 */
export function readProject(
    text: string,
    directory: string,
): {
    sources: Set<string>;
    folders: { path: string; excluded: Set<string> }[];
} {
    const project = projectSchema.parse(parse(text));
    const object = (id: string): z.infer<typeof objectSchema> => {
        const found = project.objects[id];
        if (found === undefined) throw new Error(`The Xcode project references an unknown object: ${id}.`);
        return found;
    };
    const root = object(project.rootObject);
    if (root.isa !== 'PBXProject' || root.mainGroup === undefined)
        throw new Error('The Xcode project has no main group.');
    const parents = new Map<string, string>();
    for (const [id, entry] of Object.entries(project.objects)) {
        for (const child of entry.children ?? []) {
            if (parents.has(child))
                throw new Error(`The Xcode project gives an object multiple parent groups: ${child}.`);
            parents.set(child, id);
        }
    }
    const visiting = new Set<string>();
    const resolve = (id: string): string => {
        if (visiting.has(id)) throw new Error('The Xcode project contains a group cycle.');
        visiting.add(id);
        const entry = object(id);
        const tree = entry.sourceTree ?? '<group>';
        let base: string;
        switch (tree) {
            case 'SOURCE_ROOT': {
                base = directory;
                break;
            }
            case '<absolute>': {
                base = '/';
                break;
            }
            case '<group>': {
                if (id === root.mainGroup) base = posix.join(directory, root.projectDirPath ?? '');
                else {
                    const parent = parents.get(id);
                    if (parent === undefined) throw new Error(`The Xcode project has no parent group for ${id}.`);
                    base = resolve(parent);
                }

                break;
            }
            default: {
                throw new Error(`Cannot resolve Xcode source tree ${tree} without build settings.`);
            }
        }
        const path = entry.path ?? '';
        if (/\$[({]/u.test(path)) throw new Error(`Cannot resolve Xcode source path ${path} without build settings.`);
        visiting.delete(id);
        return posix.normalize(posix.isAbsolute(path) ? path : posix.join(base, path));
    };
    const sources = new Set<string>();
    const folders: { path: string; excluded: Set<string> }[] = [];
    for (const id of root.targets ?? []) {
        const target = object(id);
        if (target.isa !== 'PBXNativeTarget') continue;
        for (const phaseId of target.buildPhases ?? []) {
            const phase = object(phaseId);
            if (phase.isa !== 'PBXSourcesBuildPhase') continue;
            for (const buildId of phase.files ?? []) {
                const build = object(buildId);
                if (build.fileRef === undefined) throw new Error('An Xcode source build entry has no file reference.');
                const file = object(build.fileRef);
                if (file.path?.endsWith('.swift') === true) sources.add(resolve(build.fileRef));
            }
        }
        for (const groupId of target.fileSystemSynchronizedGroups ?? []) {
            const group = object(groupId);
            const path = resolve(groupId);
            const excluded = new Set(
                (group.exceptions ?? []).flatMap((exceptionId) => {
                    const exception = object(exceptionId);
                    return exception.target === id
                        ? (exception.membershipExceptions ?? []).map((name) => posix.join(path, name))
                        : [];
                }),
            );
            folders.push({ path: `${path}/`, excluded });
        }
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
