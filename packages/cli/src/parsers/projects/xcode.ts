import { posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { pbxprojSchema } from '#cli/schemas/parsers/projects.ts';
import { OCTAL_RADIX, HEXADECIMAL_RADIX } from '#cli/config/units.ts';
import { PBXPROJ_SUFFIX, SWIFT_EXTENSION } from '#cli/config/files/names.ts';

import {
    type PbxElement,
    type TargetFolder,
    type XcodeProject,
    type ProjectTokens,
    type ParsedPbxproj,
    type ProjectSources,
    type ProjectBuildSettings,
} from '#cli/types/parsers/projects.ts';
import {
    PROJECT_TOKENS,
    PROJECT_ESCAPE,
    PROJECT_ESCAPES,
    SETTING_REFERENCE,
    OCTAL_ESCAPE_START,
    PROJECT_PUNCTUATION,
    GROUP_CYCLE_MESSAGE,
    MISSING_ROOT_MESSAGE,
    TRAILING_TEXT_MESSAGE,
    INVALID_STRING_MESSAGE,
    MISSING_FILE_REF_MESSAGE,
    MISSING_MAIN_GROUP_MESSAGE,
} from '#cli/config/parsers/projects.ts';

function parseProjectString(token: string | undefined): string {
    if (token === undefined || PROJECT_PUNCTUATION.has(token)) throw new Error(INVALID_STRING_MESSAGE);
    if (!token.startsWith('"')) return token;
    return token.slice(1, -1).replace(PROJECT_ESCAPE, (escape: string, sequence: string) => {
        if (sequence.startsWith('U'))
            return String.fromCodePoint(Number.parseInt(sequence.slice(1), HEXADECIMAL_RADIX));
        return OCTAL_ESCAPE_START.test(sequence)
            ? String.fromCodePoint(Number.parseInt(sequence, OCTAL_RADIX))
            : (PROJECT_ESCAPES[sequence] ?? escape);
    });
}

function expectProjectToken(tokens: ProjectTokens, expected: string): void {
    if (tokens.tokens[tokens.index] !== expected) throw new Error(`The Xcode project requires ${expected}.`);
    tokens.index += 1;
}

function parseProjectArray(tokens: ProjectTokens): unknown[] {
    const values: unknown[] = [];
    while (tokens.tokens[tokens.index] !== ')') {
        values.push(parseProjectValue(tokens));
        if (tokens.tokens[tokens.index] !== ',') break;
        tokens.index += 1;
    }
    expectProjectToken(tokens, ')');
    return values;
}

function parseProjectDictionary(tokens: ProjectTokens): Record<string, unknown> {
    const pairs: [string, unknown][] = [];
    while (tokens.tokens[tokens.index] !== '}') {
        const key = parseProjectString(tokens.tokens[tokens.index++]);
        expectProjectToken(tokens, '=');
        pairs.push([key, parseProjectValue(tokens)]);
        expectProjectToken(tokens, ';');
    }
    expectProjectToken(tokens, '}');
    return Object.fromEntries(pairs);
}

function parseProjectValue(tokens: ProjectTokens): unknown {
    const text = tokens.tokens[tokens.index++];
    if (text === '{') return parseProjectDictionary(tokens);
    return text === '(' ? parseProjectArray(tokens) : parseProjectString(text);
}

function readProjectToken(text: string, offset: number): RegExpExecArray | undefined {
    for (const matcher of PROJECT_TOKENS) {
        matcher.lastIndex = offset;
        const matched = matcher.exec(text);
        if (matched !== null) return matched;
    }
    return undefined;
}

function parseProjectDocument(text: string): unknown {
    const tokens: string[] = [];
    for (let offset = 0; offset < text.length; ) {
        const match = readProjectToken(text, offset);
        if (match === undefined) throw new Error(`The Xcode project has invalid syntax at offset ${String(offset)}.`);
        offset += match[0].length;
        const token = match[0];
        if (token.trim() !== '' && !token.startsWith('//') && !token.startsWith('/*')) tokens.push(token);
    }
    const state: ProjectTokens = { tokens, index: 0 };
    const value = parseProjectValue(state);
    if (state.index !== tokens.length) throw new Error(TRAILING_TEXT_MESSAGE);
    return value;
}

function getElement(project: Pick<XcodeProject, 'objects'>, id: string): PbxElement {
    const found = Object.hasOwn(project.objects, id) ? project.objects[id] : undefined;
    if (found === undefined) throw new Error(`The Xcode project references an unknown object: ${id}.`);
    return found;
}

function buildParentGroups(elements: Record<string, PbxElement>): Map<string, string> {
    const parents = new Map<string, string>();
    for (const [id, element] of Object.entries(elements)) {
        const children = element.children ?? [];
        for (const child of children) {
            if (parents.has(child))
                throw new Error(`The Xcode project gives an object multiple parent groups: ${child}.`);
            parents.set(child, id);
        }
    }
    return parents;
}

function buildGroupFolder(project: XcodeProject, id: string): string {
    if (id === project.root.mainGroup) return posix.join(project.folder, project.root.projectDirPath ?? '');
    const parent = project.parents.get(id);
    if (parent === undefined) throw new Error(`The Xcode project has no parent group for ${id}.`);
    return buildElementPath(project, parent);
}

function buildTreeFolder(project: XcodeProject, id: string, tree: string): string {
    if (tree === 'SOURCE_ROOT') return project.folder;
    if (tree === '<absolute>') return '/';
    if (tree === '<group>') return buildGroupFolder(project, id);
    throw new Error(`Cannot find the folder of Xcode source tree ${tree} without build settings.`);
}

function buildElementPath(project: XcodeProject, id: string): string {
    if (project.visiting.has(id)) throw new Error(GROUP_CYCLE_MESSAGE);
    project.visiting.add(id);
    const element = getElement(project, id);
    const folder = buildTreeFolder(project, id, element.sourceTree ?? '<group>');
    const path = element.path ?? '';
    if (SETTING_REFERENCE.test(path)) throw new Error(`Cannot find Xcode source path ${path} without build settings.`);
    project.visiting.delete(id);
    return posix.normalize(posix.isAbsolute(path) ? path : posix.join(folder, path));
}

function listTargetSources(project: XcodeProject, target: PbxElement): string[] {
    const phases = (target.buildPhases ?? []).map((phaseId) => getElement(project, phaseId));
    return phases
        .filter((phase) => phase.isa === 'PBXSourcesBuildPhase')
        .flatMap((phase) => phase.files ?? [])
        .flatMap((buildId) => {
            const build = getElement(project, buildId);
            if (build.fileRef === undefined) throw new Error(MISSING_FILE_REF_MESSAGE);
            const file = getElement(project, build.fileRef);
            return file.path?.endsWith(SWIFT_EXTENSION) === true ? buildElementPath(project, build.fileRef) : [];
        });
}

function listTargetFolders(project: XcodeProject, id: string, target: PbxElement): TargetFolder[] {
    return (target.fileSystemSynchronizedGroups ?? []).map((groupId) => {
        const group = getElement(project, groupId);
        const path = buildElementPath(project, groupId);
        const exceptions = (group.exceptions ?? []).map((exceptionId) => getElement(project, exceptionId));
        const excluded = exceptions
            .filter((exception) => exception.target === id)
            .flatMap((exception) => (exception.membershipExceptions ?? []).map((name) => posix.join(path, name)));
        return { path: `${path}/`, excluded: new Set(excluded) };
    });
}

function projectParseError(path: string, error: unknown): GspotError {
    const reason = error instanceof Error ? error.message : String(error);
    const punctuation = reason.endsWith('.') ? '' : '.';
    return new GspotError(
        'parse',
        `${path} is not a valid Xcode project: ${reason}${punctuation} Fix the file, then run the command again.`,
        { cause: error },
    );
}

function parsePbxproj(text: string, path: string): ParsedPbxproj {
    try {
        const project = pbxprojSchema.parse(parseProjectDocument(text));
        const root = Object.hasOwn(project.objects, project.rootObject)
            ? project.objects[project.rootObject]
            : undefined;
        if (root?.isa !== 'PBXProject') throw new Error(MISSING_ROOT_MESSAGE);
        return { objects: project.objects, root };
    } catch (error) {
        throw projectParseError(path, error);
    }
}

/**
Find the Swift sources and managed folders that belong to project targets.

@param text the project.pbxproj contents.
@param path the project.pbxproj file, relative to the repository root.
*/
export function parseProjectSources(text: string, path: string): ProjectSources {
    try {
        const folder = extractParentFolder(path.slice(0, path.indexOf(PBXPROJ_SUFFIX)));
        const parsed = parsePbxproj(text, path);
        const root = parsed.root;
        if (root.mainGroup === undefined) throw new Error(MISSING_MAIN_GROUP_MESSAGE);
        const project: XcodeProject = {
            objects: parsed.objects,
            root: { ...root, mainGroup: root.mainGroup },
            folder,
            parents: buildParentGroups(parsed.objects),
            visiting: new Set(),
        };
        const targets = (root.targets ?? []).flatMap((id) => {
            const target = getElement(project, id);
            if (target.isa !== 'PBXNativeTarget') return [];
            return [
                {
                    name: target.name ?? '',
                    sources: listTargetSources(project, target),
                    folders: listTargetFolders(project, id, target),
                },
            ];
        });
        return {
            sources: new Set(targets.flatMap((target) => target.sources)),
            folders: targets.flatMap((target) => target.folders),
            targets,
        };
    } catch (error) {
        throw projectParseError(path, error);
    }
}

/**
Find compiler and SDK settings without reading project source paths.

@param text the project file.
@param path the project.pbxproj file that the errors name.
@returns the first declared SDK and Swift version.
*/
export function parseBuildSettings(text: string, path: string): ProjectBuildSettings {
    const project = parsePbxproj(text, path);
    const settings = Object.values(project.objects).flatMap((record) => record.buildSettings ?? []);
    return {
        sdkRoot: settings.find((setting) => setting.SDKROOT !== undefined)?.SDKROOT,
        swiftVersion: settings.find((setting) => setting.SWIFT_VERSION !== undefined)?.SWIFT_VERSION,
    };
}
