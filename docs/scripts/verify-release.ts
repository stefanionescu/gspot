import { z } from 'zod';
import { execa } from 'execa';
import manifest from '@gspot/cli/package.json' with { type: 'json' };
import { environmentVariables } from '@gspot/cli/src/platform/environment.ts';

const variables = environmentVariables();
const tag = variables['DOCS_RELEASE_TAG'] ?? '';
const source = variables['DOCS_SOURCE_REF'] ?? '';
const repository = variables['GITHUB_REPOSITORY'] ?? '';
if (!/^v\d+\.\d+\.\d+$/u.test(tag) || tag !== `v${manifest.version}`) {
    throw new Error('Documentation requires a stable release tag matching the CLI version.');
}
if (source !== '' && !/^[a-f\d]{40}$/u.test(source))
    throw new Error('A documentation correction requires an exact commit ID.');
if (!/^[\w.-]+\/[\w.-]+$/u.test(repository)) throw new Error('The source repository identity is missing.');
const cwd = process.cwd();
const released = await execa('gh', ['api', `repos/${repository}/releases/tags/${tag}`], {
    cwd,
    timeout: 30_000,
    reject: false,
});
if (released.exitCode !== 0) throw new Error(`Cannot verify the published release: ${released.stderr}`);
const release = z
    .object({
        draft: z.literal(false),
        prerelease: z.literal(false),
        tag_name: z.literal(tag),
        published_at: z.string().min(1),
    })
    .parse(JSON.parse(released.stdout));
const current = await execa('git', ['rev-parse', '--verify', 'HEAD'], { cwd, timeout: 30_000, reject: false });
if (current.exitCode !== 0 || (source !== '' && current.stdout.trim() !== source)) {
    throw new Error('The checked-out source does not match the requested documentation revision.');
}
const ancestor = await execa('git', ['merge-base', '--is-ancestor', release.tag_name, 'HEAD'], {
    cwd,
    timeout: 30_000,
    reject: false,
});
if (ancestor.exitCode !== 0) throw new Error('Documentation source must descend from the published release.');
const changed = await execa('git', ['diff', '--no-renames', '--name-only', '-z', release.tag_name, 'HEAD'], {
    cwd,
    timeout: 30_000,
    reject: false,
});
if (changed.exitCode !== 0) throw new Error(`Cannot verify documentation-only changes: ${changed.stderr}`);
const invalid = changed.stdout
    .split('\0')
    .filter(Boolean)
    .filter((path) => !path.startsWith('docs/') && path !== 'README.md' && path !== '.github/workflows/site.yml');
if (invalid.length > 0) throw new Error(`Documentation correction changes product inputs: ${invalid.join(', ')}`);
