import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { escapeRegExp } from '#cli/system/text.ts';
import type { Session } from '#cli/types/tools.ts';
import { findText } from '#cli/system/files/reads.ts';
import { WHITESPACE_RUN } from '#cli/config/parsers.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import type { ComponentScript } from '#cli/types/parsers.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { AssetSource, AssetGlobImport } from '#cli/types/configurations/language.ts';
import { readStringLiteral, listJavascriptSources } from '#cli/parsers/code/environment.ts';
import { SYMLINK_MODE, FILENAME_TAGS, GIT_FILE_MODES } from '#cli/config/repository/files.ts';

import {
    ASSET_FOLDER,
    TEXT_EXTENSIONS,
    ASSET_GLOB_CALL,
    UNUSED_ASSET_RULE,
    CONVENTIONAL_ASSETS,
    UNUSED_ASSET_MESSAGE,
    ASSET_REFERENCE_PREFIX,
    ASSET_REFERENCE_SUFFIX,
} from '#cli/config/configurations/framework.ts';

function readGlobPatterns(node: Node): string[] | undefined {
    const argument = node.childForFieldName('arguments')?.namedChild(0);
    if (argument?.type !== 'array') {
        const pattern = readStringLiteral(argument);
        return pattern === undefined ? undefined : [pattern];
    }
    const patterns = argument.namedChildren.map((element) => readStringLiteral(element));
    return patterns.includes(undefined) ? undefined : (patterns as string[]);
}

async function readGlobImports(source: ComponentScript, session: Session): Promise<AssetGlobImport[]> {
    using tree = await parseSource(source.grammar, source.source, session);
    return tree.rootNode.descendantsOfType('call_expression').flatMap((node) => {
        const name = node.childForFieldName('function')?.text.replaceAll(WHITESPACE_RUN, '');
        const patterns = name === ASSET_GLOB_CALL ? readGlobPatterns(node) : undefined;
        return patterns === undefined ? [] : [{ patterns, text: node.text }];
    });
}

async function readAssetSource(path: string, text: string, session: Session, scope: string): Promise<AssetSource> {
    const matchers: ((path: string) => boolean)[] = [];
    let references = text;
    const sources = text.includes(ASSET_GLOB_CALL) ? await listJavascriptSources(path, text) : [];
    for (const source of sources) {
        for (const imported of await readGlobImports(source, session)) {
            const patterns = imported.patterns.map((pattern) => {
                const negative = pattern.startsWith('!');
                const bare = negative ? pattern.slice(1) : pattern;
                const target = bare.startsWith('/')
                    ? posix.join(scope, bare.slice(1))
                    : posix.join(extractParentFolder(path), bare);
                return negative ? `!${target}` : target;
            });
            matchers.push(buildPathMatcher(patterns));
            references = references.replaceAll(imported.text, '');
        }
    }

    return { path, text: references, matches: (file) => matchers.some((match) => match(file)) };
}

/**
Report assets absent from the text files and index. Exclude files that browsers and hosts load by name.

@param session the repository and its tools.
@param planned the scope files and the tracked files.
*/
export async function checkSiteUnusedAssets(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const local = new Set(planned.files.map((file) => file.path));
    const paths = new Set([
        ...local,
        ...session.repository.index
            .filter(
                (indexFile) =>
                    indexFile.stage === 0 &&
                    indexFile.mode !== SYMLINK_MODE &&
                    Object.hasOwn(GIT_FILE_MODES, indexFile.mode),
            )
            .map((indexFile) => indexFile.path),
    ]);
    const texts: AssetSource[] = [];
    for (const path of paths) {
        const text = TEXT_EXTENSIONS.has(posix.extname(path)) ? findText(session.cache, path) : undefined;
        if (text !== undefined) texts.push(await readAssetSource(path, text, session, planned.scope.path));
    }
    return planned.files
        .filter(
            (file) =>
                ASSET_FOLDER.test(file.path) &&
                !FILENAME_TAGS.has(posix.basename(file.path)) &&
                !TEXT_EXTENSIONS.has(posix.extname(file.path)) &&
                !CONVENTIONAL_ASSETS.test(file.path),
        )
        .filter((file) => {
            const folder = ASSET_FOLDER.exec(file.path);
            const belowAssets = file.path.slice((folder?.index ?? 0) + (folder?.[0].length ?? 0));
            const reference = new RegExp(
                `${ASSET_REFERENCE_PREFIX}/?${escapeRegExp(belowAssets)}${ASSET_REFERENCE_SUFFIX}`,
                'u',
            );
            return !texts.some(
                ({ path, text, matches }) =>
                    matches(file.path) ||
                    reference.test(text) ||
                    text.includes(posix.relative(extractParentFolder(path), file.path)),
            );
        })
        .map((file) => ({
            file: file.path,
            line: 1,
            rule: UNUSED_ASSET_RULE,
            message: UNUSED_ASSET_MESSAGE,
        }));
}
