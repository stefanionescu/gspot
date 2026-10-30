import type ts from 'typescript';
import { posix } from 'node:path';
import { find } from '#cli/system/files/reads.ts';
import type { Session } from '#cli/types/session.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { type CheckFinding } from '#cli/types/runs/check.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import { FILENAME_TAGS } from '#cli/config/repository/files/classify.ts';
import { SYMLINK_MODE, GIT_FILE_MODES } from '#cli/config/files/modes.ts';
import type { AssetSource, AssetGlobImport } from '#cli/types/checks/site.ts';
import { ASTRO_EXTENSION, ASTRO_FRONT_MATTER } from '#cli/config/parsers/code/comments.ts';
import { COMPONENT_SCRIPT, COMPONENT_EXTENSION } from '#cli/config/parsers/code/environment.ts';

import {
    ASSET_FOLDER,
    TEXT_EXTENSIONS,
    UNUSED_ASSET_RULE,
    CONVENTIONAL_ASSETS,
    UNUSED_ASSET_MESSAGE,
    ASSET_REFERENCE_PREFIX,
    ASSET_REFERENCE_SUFFIX,
} from '#cli/config/checks/framework/site/unused-assets.ts';

function readGlobPatterns(node: ts.Node): string[] | undefined {
    const ts = requireTypescript();
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return undefined;
    const expression = node.expression;
    if (expression.name.text !== 'glob' || !ts.isMetaProperty(expression.expression)) return undefined;
    if (
        expression.expression.keywordToken !== ts.SyntaxKind.ImportKeyword ||
        expression.expression.name.text !== 'meta'
    )
        return undefined;
    return readGlobArguments(node.arguments[0]);
}

function readGlobArguments(argument: ts.Expression | undefined): string[] | undefined {
    const ts = requireTypescript();
    if (argument === undefined) return undefined;
    if (ts.isStringLiteralLike(argument)) return [argument.text];
    if (!ts.isArrayLiteralExpression(argument)) return undefined;
    const patterns = argument.elements.filter((element) => ts.isStringLiteralLike(element));
    return patterns.length === argument.elements.length ? patterns.map((pattern) => pattern.text) : undefined;
}

function readGlobImports(path: string, script: string): AssetGlobImport[] {
    const ts = requireTypescript();
    const source = ts.createSourceFile(path, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const imports: AssetGlobImport[] = [];
    const visit = (node: ts.Node): void => {
        const patterns = readGlobPatterns(node);
        if (patterns !== undefined) imports.push({ patterns, text: node.getText(source) });
        ts.forEachChild(node, visit);
    };
    visit(source);
    return imports;
}

function readAssetSource(path: string, text: string, scope: string): AssetSource {
    const matchers: ((path: string) => boolean)[] = [];
    let references = text;
    const scripts = COMPONENT_EXTENSION.test(path)
        ? [
              ...(path.endsWith(ASTRO_EXTENSION) ? [ASTRO_FRONT_MATTER.exec(text)?.[1]] : []),
              ...[...text.matchAll(COMPONENT_SCRIPT)].map((script) => script.groups?.['body']),
          ]
        : [text];
    for (const script of scripts) {
        if (script?.includes('glob') !== true) continue;
        for (const imported of readGlobImports(path, script)) {
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
export function checkSiteUnusedAssets(session: Session, planned: PlannedCheck): CheckFinding[] {
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
    const texts = paths
        .values()
        .filter((path) => TEXT_EXTENSIONS.has(posix.extname(path)))
        .map((path) => {
            const text = find(session.cache, path);
            return text === undefined ? undefined : readAssetSource(path, text, planned.scope.path);
        })
        .filter((source) => source !== undefined)
        .toArray();
    return planned.files
        .filter(
            (file) =>
                ASSET_FOLDER.test(file.path) &&
                !FILENAME_TAGS.has(posix.basename(file.path)) &&
                !TEXT_EXTENSIONS.has(posix.extname(file.path)) &&
                !CONVENTIONAL_ASSETS.test(file.path),
        )
        .filter((file) => {
            const belowAssets = file.path.slice(
                (ASSET_FOLDER.exec(file.path)?.index ?? 0) + (ASSET_FOLDER.exec(file.path)?.[0].length ?? 0),
            );
            const reference = new RegExp(
                `${ASSET_REFERENCE_PREFIX}/?${RegExp.escape(belowAssets)}${ASSET_REFERENCE_SUFFIX}`,
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
