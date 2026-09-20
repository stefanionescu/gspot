import { join } from 'node:path';
import { styleFiles } from '#cli/prose/vale.ts';
import type { MergedView } from '#types/config.ts';
import { existsSync, readFileSync } from 'node:fs';
// Every generated file for the selection: path, template, stub; the managed blocks and the merge stubs beside them.
import { hasEveryPin } from '#cli/emit/kept-pins.ts';
import { workflowFile } from '#cli/emit/workflow.ts';
import { assembleRules } from '#cli/rules/assemble.ts';
import { everyManifest } from '#cli/presets/select.ts';
import { GENERATED_JSON_KEY } from '#config/markers.ts';
import { targetInScope } from '#cli/run/scope-paths.ts';
import { bodyStub, mergeStub } from '#cli/emit/stubs.ts';
import { managedBlock } from '#cli/rules/managed-block.ts';
import type { ScopeSelection, Session } from '#types/run.ts';
import { gitignoreBlock } from '#cli/emit/managed-blocks.ts';
import { binaryPath, readAsset } from '#cli/platform/assets.ts';
import type { ConfigurationTarget, Manifest } from '#types/manifest.ts';
import { gspotHooks, huskyLines, lefthookBlock } from '#cli/emit/hooks.ts';
import { miseTasks, npmPins, npmScripts } from '#cli/emit/runner-tasks.ts';
import { emitTarget, templateText, templateInputs } from '#cli/emit/templates.ts';
import type { EmitContext, GeneratedFile, PackageContent, PackageOutput, RenderedSet } from '#types/emit.ts';

const JSON_INDENT = 4;
const NPM_RUNNERS = new Set(['bun', 'npm', 'pnpm']);

function copyStubContent(content: string, stubPath: string): string {
    if (!stubPath.endsWith('.json')) return content;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    Reflect.deleteProperty(parsed, GENERATED_JSON_KEY);
    return `${JSON.stringify(parsed, null, JSON_INDENT)}\n`;
}

function pathInScope(scope: string, path: string): string {
    return scope === '' ? path : `${scope}/${path}`;
}

// The presets whose fragments a target takes: a target written for one scope asks that scope, and a target written once asks every scope.
function fragmentOwners(session: Session, selection: ScopeSelection, owner: ConfigurationTarget): Manifest[] {
    if (owner.per_scope) return selection.selected;
    const every = [selection, ...session.scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((manifest) => [manifest.preset.name, manifest])).values().toArray();
}

function fragmentsFor(session: Session, selection: ScopeSelection, owner: ConfigurationTarget): string {
    return fragmentOwners(session, selection, owner)
        .flatMap((manifest) =>
            manifest.configs
                .filter((fragment) => fragment.fragment && fragment.target === owner.target)
                .map((fragment) =>
                    templateText(readAsset(`${manifest.dir}/${fragment.template}`), templateInputs(session, selection)),
                ),
        )
        .join('\n');
}

function stubFor(context: EmitContext, config: ConfigurationTarget, file: GeneratedFile, out: RenderedSet): void {
    const { session, selection, manifest } = context;
    const { stub } = config;
    if (!stub) return;
    const stubPath = pathInScope(config.per_scope ? selection.scope.path : '', stub.path);
    if (stub.merge) out.merges.push({ ...mergeStub(session.root, stub, stubPath, file.path), target: file.path, stub });
    else if (stub.copy === true)
        out.files.push({
            path: stubPath,
            content: copyStubContent(file.content, stubPath),
            readOnly: true,
            kind: 'stub',
            preset: manifest.preset.name,
        });
    else out.files.push(bodyStub(stub, stubPath, file.path, session.version, manifest.preset.name));
}

// A target with a needs key is written only while the preset it names is selected somewhere in the repository.
function isWanted(config: ConfigurationTarget, session: Session): boolean {
    if (config.needs === undefined) return true;
    const wanted = config.needs;
    return session.scopes.some((entry) => entry.selected.some((manifest) => manifest.preset.name === wanted));
}

// A target that is not written for each scope is written once, by the first scope that selects its preset.
// The set of targets already seen keeps the root first, so a preset the root selects is rendered with the root settings.
function isRenderedHere(config: ConfigurationTarget): boolean {
    return !config.fragment;
}

function configurationFiles(
    session: Session,
    selection: ScopeSelection,
    manifest: Manifest,
    out: RenderedSet,
    seen: Set<string>,
): void {
    for (const config of manifest.configs) {
        if (!isRenderedHere(config) || !isWanted(config, session)) continue;
        const target = targetInScope(selection.scope.path, config);
        if (seen.has(target)) continue;
        seen.add(target);
        const inputs = templateInputs(session, selection, fragmentsFor(session, selection, config));
        const file: GeneratedFile = {
            path: target,
            content: emitTarget(`${manifest.dir}/${config.template}`, target, inputs, config.header),
            readOnly: true,
            kind: 'config',
            preset: manifest.preset.name,
        };
        out.files.push(file);
        stubFor({ session, selection, manifest }, config, file, out);
    }
}

function hookOutputs(session: Session, out: RenderedSet, binary: string | undefined): void {
    const { policy } = session.policyFiles;
    const runner = policy.runner?.tool;
    switch (policy.hooks?.tool) {
        case 'gspot': {
            out.files.push(...gspotHooks(runner, binary));
            break;
        }
        case 'husky': {
            for (const line of huskyLines(runner, binary))
                out.blocks.push({ path: line.path, block: line.line, style: 'hash' });
            break;
        }
        case 'lefthook': {
            const path =
                ['lefthook.yml', '.lefthook.yml'].find((name) => existsSync(join(session.root, name))) ??
                'lefthook.yml';
            out.lefthook = {
                path,
                block: lefthookBlock(runner, binary),
            };

            break;
        }
        // No default
    }
}

function runnerOutputs(session: Session, out: RenderedSet): void {
    const runner = session.policyFiles.policy.runner?.tool;
    if (runner === undefined) return;
    const isRootPackage = hasRootPackage(session.root);
    if (runner === 'mise') out.files.push(miseTasks(everyManifest(session), session.version, isRootPackage));
    const isNpmRunner = NPM_RUNNERS.has(runner);
    if (isRootPackage && (isNpmRunner || runner === 'mise'))
        out.packages.push({
            path: 'package.json',
            devDependencies: npmPins(everyManifest(session), runner),
            scripts: isNpmRunner ? npmScripts() : {},
        });
}

function workflowOutput(session: Session, out: RenderedSet): void {
    const { policy } = session.policyFiles;
    if (policy.ci?.provider !== 'github') return;
    const swiftScope = session.scopes.find((selection) =>
        selection.selected.some((manifest) => manifest.preset.name === 'swift'),
    );
    out.files.push(
        workflowFile({
            version: session.version,
            platforms: policy.ci.platforms,
            swiftScope: swiftScope?.scope.path,
            isMise: policy.runner?.tool === 'mise',
        }),
    );
}

function rootView(session: Session): MergedView {
    const root = session.scopes.find((selection) => selection.scope.path === '') ?? session.scopes[0];
    if (root === undefined) throw new Error('The session has no scope.');
    return root.view;
}

function blockOutputs(session: Session, out: RenderedSet): void {
    out.blocks.push({ path: '.gitignore', block: gitignoreBlock(), style: 'hash' });
    if (!session.policyFiles.policy.rules.install) return;
    const block = managedBlock(session);
    out.blocks.push({ path: 'CLAUDE.md', block, style: 'markdown' }, { path: 'AGENTS.md', block, style: 'markdown' });
}

/**
 * True when the root holds a package.json, which is where npm tools are pinned.
 * @param root the repository root
 * @returns whether the file is there
 */
export function hasRootPackage(root: string): boolean {
    return existsSync(join(root, 'package.json'));
}

/**
 * True when package.json already carries every pin and script the output asks for.
 * @param root the repository root
 * @param output the pins and scripts wanted
 * @returns whether nothing needs writing
 */
export function hasPackagePins(root: string, output: PackageOutput): boolean {
    const full = join(root, output.path);
    if (!existsSync(full)) return false;
    let manifestContent: PackageContent;
    try {
        manifestContent = JSON.parse(readFileSync(full, 'utf8')) as PackageContent;
    } catch {
        return false;
    }
    return (
        hasEveryPin(manifestContent.devDependencies, output.devDependencies) &&
        Object.entries(output.scripts).every(([name, command]) => manifestContent.scripts?.[name] === command)
    );
}

/**
 * Renders every generated file, block and merge for the session, in memory.
 * @param session the session
 * @returns the files, blocks, merges and package edits
 */
export function emitAll(session: Session): RenderedSet {
    const binary = binaryPath();
    const out: RenderedSet = { files: [], blocks: [], merges: [], packages: [] };
    const seen = new Set<string>();
    for (const selection of session.scopes)
        for (const manifest of selection.selected) configurationFiles(session, selection, manifest, out, seen);
    hookOutputs(session, out, binary);
    runnerOutputs(session, out);
    workflowOutput(session, out);
    out.files.push(...assembleRules(session));
    if (session.scopes.some((selection) => selection.selected.some((manifest) => manifest.preset.name === 'prose')))
        out.files.push(...styleFiles(session.policyFiles.policy, rootView(session)));
    blockOutputs(session, out);
    out.files.sort((a, b) => a.path.localeCompare(b.path));
    return out;
}
