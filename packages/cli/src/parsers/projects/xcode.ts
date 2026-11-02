import { posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { pbxprojSchema } from '#cli/schemas/parsers.ts';
import { extractParentFolder } from '#cli/system/paths.ts';

import type {
    PbxElement,
    TargetFolder,
    XcodeProject,
    ProjectTokens,
    ParsedPbxproj,
    ProjectSources,
    ProjectBuildTarget,
    ProjectBuildSettings,
} from '#cli/types/parsers.ts';
import {
    OCTAL_RADIX,
    PBXPROJ_SUFFIX,
    PROJECT_TOKENS,
    PROJECT_ESCAPE,
    SWIFT_EXTENSION,
    PROJECT_ESCAPES,
    SWIFT_SIX_PREFIX,
    HEXADECIMAL_RADIX,
    SETTING_REFERENCE,
    STRICT_CONCURRENCY,
    OCTAL_ESCAPE_START,
    PROJECT_PUNCTUATION,
    GROUP_CYCLE_MESSAGE,
    MISSING_ROOT_MESSAGE,
    TRAILING_TEXT_MESSAGE,
    INVALID_STRING_MESSAGE,
    MISSING_FILE_REF_MESSAGE,
    MISSING_MAIN_GROUP_MESSAGE,
} from '#cli/config/parsers.ts';

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

function matchProjectToken(text: string, offset: number): RegExpExecArray | undefined {
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
        const match = matchProjectToken(text, offset);
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

function buildProjectParseError(path: string, error: unknown): GspotError {
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
        throw buildProjectParseError(path, error);
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
        throw buildProjectParseError(path, error);
    }
}

function listConfigurations(project: ParsedPbxproj, list: string | undefined): PbxElement[] {
    const configurations = list === undefined ? [] : (getElement(project, list).buildConfigurations ?? []);
    return configurations.map((configuration) => getElement(project, configuration));
}

function isStrictConfiguration(project: ParsedPbxproj, list: string | undefined): boolean {
    const shared = listConfigurations(project, project.root.buildConfigurationList);
    return listConfigurations(project, list).every((configuration) => {
        if (configuration.baseConfigurationReference !== undefined) return true;
        const inherited = shared.find((each) => each.name === configuration.name)?.buildSettings;
        const settings = { ...inherited, ...configuration.buildSettings };
        return (
            settings.SWIFT_STRICT_CONCURRENCY === STRICT_CONCURRENCY ||
            settings.SWIFT_VERSION?.startsWith(SWIFT_SIX_PREFIX) === true
        );
    });
}

/**
List the native targets of a project with their concurrency setting and run-script phases.

@param text the project file.
@param path the project.pbxproj file that the errors name.
*/
export function parseBuildTargets(text: string, path: string): ProjectBuildTarget[] {
    const project = parsePbxproj(text, path);
    try {
        return (project.root.targets ?? []).flatMap((id) => {
            const target = getElement(project, id);
            if (target.isa !== 'PBXNativeTarget') return [];
            const phases = (target.buildPhases ?? []).map((phaseId) => getElement(project, phaseId));
            return [
                {
                    name: target.name ?? id,
                    isStrict: isStrictConfiguration(project, target.buildConfigurationList),
                    scripts: phases
                        .filter((phase) => phase.isa === 'PBXShellScriptBuildPhase')
                        .map((phase) => ({
                            name: phase.name ?? 'Run Script',
                            script: phase.shellScript ?? '',
                            hasFiles: [
                                phase.inputPaths,
                                phase.outputPaths,
                                phase.inputFileListPaths,
                                phase.outputFileListPaths,
                            ].some((paths) => paths !== undefined && paths.length > 0),
                        })),
                },
            ];
        });
    } catch (error) {
        throw buildProjectParseError(path, error);
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
