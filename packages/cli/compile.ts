import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { Command, CommanderError, InvalidArgumentError } from 'commander';
import { releaseTargets } from '#cli/emit/targets-definitions.ts';
import packageManifest from '#package' with { type: 'json' };

function target(value: string): Bun.Build.CompileTarget {
    if (!releaseTargets.some((entry) => entry.target === value))
        throw new InvalidArgumentError(`Unsupported compile target: ${value}`);
    return value as Bun.Build.CompileTarget;
}

const script = new Command()
    .name('compile.ts')
    .description('Compile a gspot entry with its native parser assets embedded.')
    .version(packageManifest.version)
    .argument('<entry>', 'Generated entry module')
    .requiredOption('--target <target>', 'Supported Bun target', target)
    .requiredOption('--outfile <path>', 'Output executable')
    .requiredOption('--metafile <path>', 'Dependency metadata')
    .exitOverride();

try {
    script.parse();
    const options = script.opts<{ target: Bun.Build.CompileTarget; outfile: string; metafile: string }>();
    const result = await Bun.build({
        entrypoints: script.args,
        target: 'bun',
        compile: { target: options.target, outfile: options.outfile },
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
    writeFileSync(options.metafile, JSON.stringify(result.metafile));
} catch (error) {
    if (!(error instanceof CommanderError)) throw error;
    process.exitCode = error.exitCode === 0 ? 0 : 2;
}
