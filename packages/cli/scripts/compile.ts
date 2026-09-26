import { execaSync } from 'execa';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { grammarAssets, writeEntry } from './assets.ts';
import { prepareInput } from './inputs.ts';
import { grammarPath, SWIFT_GRAMMAR } from '#cli/platform/assets.ts';
import { binaryNotices, dependencyNotices } from './notices.ts';
import { releaseTargets } from './targets.ts';
const here = fileURLToPath(new URL('..', import.meta.url));
const root = join(here, '..', '..');
const TARGETS = Object.fromEntries(releaseTargets.map((target) => [target.target, target.binary]));

/**
 * Compiles the CLI for the selected targets, with its notices and embedded assets.
 * @param targets the release targets to build
 * @param out the folder the binaries are written to
 */
export async function build(targets: string[], out: string): Promise<void> {
    await prepareInput(join(here, '.build/swift.wasm'), SWIFT_GRAMMAR);
    const grammarSources = Object.keys(grammarAssets).filter((path) => path !== grammarPath('swift.wasm'));
    await binaryNotices('');
    mkdirSync(join(here, '.build'), { recursive: true });
    const evaluator = await Bun.build({
        entrypoints: [join(here, 'src/evaluation/process.ts')],
        target: 'bun',
        minify: { syntax: true },
        metafile: true,
        outdir: join(here, '.build'),
        naming: 'configuration-process.js',
        root: here,
    });
    if (!evaluator.success) throw new Error(evaluator.logs.map((log) => log.message).join('\n'));
    const metadata = [{ inputs: evaluator.metafile!.inputs, cwd: process.cwd() }];
    const entry = writeEntry();
    mkdirSync(out, { recursive: true });
    for (const target of targets) {
        const name = TARGETS[target];
        if (name === undefined) throw new Error(`Unknown target ${target}; known: ${Object.keys(TARGETS).join(', ')}`);
        const outfile = join(out, name);
        rmSync(outfile, { force: true });
        const result = await Bun.build({
            entrypoints: [entry],
            target: 'bun',
            root: here,
            compile: { target: target as Bun.Build.CompileTarget, outfile },
            minify: { syntax: true },
            metafile: true,
            plugins: [
                {
                    name: 'editorconfig-wasm',
                    setup(builder) {
                        builder.onLoad({ filter: /[\\/]@one-ini[\\/]wasm[\\/]one_ini\.js$/u }, (input) => {
                            const source = readFileSync(input.path, 'utf8');
                            const declaration = 'const wasmPath = `${__dirname}/one_ini_bg.wasm`;';
                            if (!source.includes(declaration))
                                throw new Error('The EditorConfig WASM loader changed. Update its build integration.');
                            const asset = join(dirname(input.path), 'one_ini_bg.wasm');
                            return {
                                contents: `import wasmPath from ${JSON.stringify(asset)} with { type: 'file' };\n${source.replace(declaration, '')}`,
                                loader: 'js',
                            };
                        });
                    },
                },
            ],
        });
        if (!result.success) throw new Error(result.logs.map((log) => log.message).join('\n'));
        metadata.push({ inputs: result.metafile!.inputs, cwd: process.cwd() });
        if (process.platform === 'darwin' && target.startsWith('bun-darwin-')) {
            execaSync('codesign', ['--force', '--sign', '-', outfile], {
                stdout: 'inherit',
                stderr: 'inherit',
            });
        }
        console.log(`built ${relative(root, outfile)}`);
    }
    const dependencies = await dependencyNotices(metadata, grammarSources);
    const notice = await binaryNotices(dependencies);
    writeFileSync(join(out, 'NOTICE.md'), notice);
    copyFileSync(join(root, 'LICENSE.md'), join(out, 'LICENSE.md'));
}
