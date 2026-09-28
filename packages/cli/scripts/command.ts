import { join } from 'node:path';
import { build } from './compile.ts';
import { familySync } from 'detect-libc';
import { fileURLToPath } from 'node:url';
import { releaseTargets } from './targets.ts';
import packageManifest from '#package' with { type: 'json' };
import { Command, CommanderError, InvalidArgumentError } from 'commander';

const here = fileURLToPath(new URL('..', import.meta.url));
const root = join(here, '..', '..');
const TARGETS = Object.fromEntries(releaseTargets.map((target) => [target.target, target.binary]));

function collectTargets(value: string, previous: string[]): string[] {
    if (TARGETS[value] === undefined)
        throw new InvalidArgumentError(`Unknown target ${value}. Choose ${Object.keys(TARGETS).join(', ')}.`);
    return [...previous, value];
}

function outputDirectory(value: string): string {
    if (value.trim() === '') throw new InvalidArgumentError('The output directory must not be empty.');
    return value;
}

try {
    const script = new Command('bun packages/cli/scripts/command.ts')
        .description('Build the gspot executable for selected platforms')
        .version(packageManifest.version)
        .option('--target <targets...>', 'Bun compile targets', collectTargets, [])
        .option('--all', 'Build every target in the release manifest')
        .option('--out <directory>', 'Directory for the executables', outputDirectory, join(root, 'dist'))
        .allowExcessArguments(false)
        .showHelpAfterError()
        .addHelpText('after', '\nExample: bun packages/cli/scripts/command.ts --target bun-linux-arm64 --out dist')
        .exitOverride()
        .parse();
    const options = script.opts<{ target: string[]; out: string; all?: boolean }>();
    if (options.all === true) {
        if (options.target.length > 0) throw new InvalidArgumentError('Choose --all or --target, not both.');
        options.target.push(...releaseTargets.map((target) => target.target));
    }
    const libc = process.platform === 'linux' ? familySync() : null;
    const current = releaseTargets.find(
        (target) => target.os === process.platform && target.cpu === process.arch && target.libc === libc,
    );
    if (options.target.length === 0) {
        if (current === undefined)
            throw new InvalidArgumentError(
                `Unsupported build host: ${process.platform} ${process.arch} ${String(libc)}.`,
            );
        options.target.push(current.target);
    }
    await build(options.target, options.out);
} catch (error) {
    if (!(error instanceof CommanderError)) throw error;
    process.exitCode = error.exitCode === 0 ? 0 : 2;
}
