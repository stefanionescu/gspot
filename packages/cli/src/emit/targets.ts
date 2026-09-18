// Every generated file for the selection: path, template, stub; the managed blocks and the merge stubs beside them.
import { gitignoreBlock } from '#cli/render/managed-blocks.ts';
import { gspotHooks } from '#cli/render/hooks.ts';
import { miseSurface } from '#cli/render/runner-surface.ts';
import { bodyStub, mergeStub } from '#cli/render/stubs.ts';
import { renderTarget, renderText, templateData } from '#cli/render/templates.ts';
import { workflowFile } from '#cli/render/workflow.ts';
import { assembleRules } from '#cli/rules/assemble.ts';
import { managedBlock } from '#cli/rules/managed-block.ts';
import { readAsset } from '#cli/platform/assets.ts';
import type { ScopeSelection, Session } from '#cli/run/session.ts';
import { everyManifest } from '#cli/run/session.ts';
import { GENERATED_JSON_KEY, VERSION_FILE_LINE } from '#config/markers.ts';
import type { ConfigTarget, Manifest } from '#types/manifest.ts';
import type { GeneratedFile } from '#types/render.ts';

export type BlockRender = { path: string; block: string; style: 'markdown' | 'hash' };

export type MergeRender = {
    path: string;
    content: string;
    keys: string[];
    target: string;
    stub: ConfigTarget['stub'] & object;
};

export type RenderedSet = { files: GeneratedFile[]; blocks: BlockRender[]; merges: MergeRender[] };

function copyStubContent(content: string, stubPath: string): string {
    if (!stubPath.endsWith('.json')) return content;
    const data = JSON.parse(content) as Record<string, unknown>;
    delete data[GENERATED_JSON_KEY];
    return `${JSON.stringify(data, null, 4)}\n`;
}

function scopedPath(scope: string, path: string): string {
    return scope === '' ? path : `${scope}/${path}`;
}

function targetPath(scope: string, config: ConfigTarget): string {
    if (!config.per_scope || scope === '') return config.target;
    return config.target.startsWith('.gspot/')
        ? `.gspot/${scope}/${config.target.slice(7)}`
        : scopedPath(scope, config.target);
}

function fragmentsFor(session: Session, selection: ScopeSelection, owner: ConfigTarget): string {
    const parts: string[] = [];
    for (const manifest of selection.selected) {
        for (const fragment of manifest.configs) {
            if (!fragment.fragment || fragment.target !== owner.target) continue;
            parts.push(renderText(readAsset(`${manifest.dir}/${fragment.template}`), templateData(session, selection)));
        }
    }
    return parts.join('\n');
}

function configFiles(
    session: Session,
    selection: ScopeSelection,
    manifest: Manifest,
    out: RenderedSet,
    seen: Set<string>,
): void {
    for (const config of manifest.configs) {
        if (config.fragment) continue;
        if (!config.per_scope && selection.scope.path !== '') continue;
        const target = targetPath(selection.scope.path, config);
        if (seen.has(target)) continue;
        seen.add(target);
        const data = templateData(session, selection, fragmentsFor(session, selection, config));
        const file: GeneratedFile = {
            path: target,
            content: renderTarget(`${manifest.dir}/${config.template}`, target, data, config.header !== false),
            readOnly: true,
            kind: 'config',
            preset: manifest.preset.id,
        };
        if (config.executable) file.executable = true;
        out.files.push(file);
        if (!config.stub) continue;
        const stubPath = scopedPath(config.per_scope ? selection.scope.path : '', config.stub.path);
        if (config.stub.merge)
            out.merges.push({ ...mergeStub(session.root, config.stub, stubPath, target), target, stub: config.stub });
        else if (config.stub.copy)
            out.files.push({
                path: stubPath,
                content: copyStubContent(file.content, stubPath),
                readOnly: true,
                kind: 'stub',
                preset: manifest.preset.id,
            });
        else out.files.push(bodyStub(config.stub, stubPath, target, session.version, manifest.preset.id));
    }
}

/** Renders every generated file, block and merge for the session, in memory. */
export function renderAll(session: Session, binaryPath?: string): RenderedSet {
    const out: RenderedSet = { files: [], blocks: [], merges: [] };
    const { policy } = session.loaded;
    out.files.push({
        path: '.gspot/version',
        content: VERSION_FILE_LINE.replace('{{version}}', session.version),
        readOnly: false,
        kind: 'version',
    });
    const seen = new Set<string>();
    for (const selection of session.scopes)
        for (const manifest of selection.selected) configFiles(session, selection, manifest, out, seen);
    if (policy.hooks.manager === 'gspot') out.files.push(...gspotHooks(policy.runner.surface, binaryPath));
    if (policy.runner.surface === 'mise') out.files.push(miseSurface(everyManifest(session), session.version));
    if (policy.ci.provider === 'github') {
        const swiftScope = session.scopes.find((selection) =>
            selection.selected.some((manifest) => manifest.preset.id === 'swift'),
        );
        out.files.push(
            workflowFile(
                session.version,
                policy.ci.platforms,
                swiftScope !== undefined,
                swiftScope?.scope.path ?? '',
                policy.runner.surface === 'mise',
            ),
        );
    }
    out.files.push(...assembleRules(session));
    out.blocks.push({ path: '.gitignore', block: gitignoreBlock(), style: 'hash' });
    if (policy.rules.install) {
        const block = managedBlock(session);
        out.blocks.push(
            { path: 'CLAUDE.md', block, style: 'markdown' },
            { path: 'AGENTS.md', block, style: 'markdown' },
        );
    }
    out.files.sort((a, b) => a.path.localeCompare(b.path));
    return out;
}
