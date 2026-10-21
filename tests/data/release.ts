export const RELEASE_TAGS = ['eslint-plugin-v0.0.0-test', 'v0.0.0-test'];

export const RELEASE_RETRY_CASES = [
    {
        name: 'both versions were published before deployment failed',
        published: ['@example/plugin', '@example/cli'],
        localTags: [],
        remoteTags: [],
        release: false,
    },
    {
        name: 'only the plugin version was published',
        published: ['@example/plugin'],
        localTags: [],
        remoteTags: [],
        release: false,
    },
    {
        name: 'both package tags and the GitHub release already exist',
        published: ['@example/plugin', '@example/cli'],
        localTags: RELEASE_TAGS,
        remoteTags: RELEASE_TAGS,
        release: true,
    },
];

export const RELEASE_COMMAND_FAKE = `
const { basename, join } = await import('node:path');
const { readFileSync, writeFileSync } = await import('node:fs');
const name = basename(process.argv[1], '.js');
const args = process.argv.slice(2);
const path = process.env.GSPOT_RELEASE_STATE;
const state = JSON.parse(readFileSync(path, 'utf8'));
state.calls.push([name, ...args]);
let code = 0;
let output = '';
if (name === 'npm') {
    if (args[0] === 'pkg' && args[1] === 'get') {
        const manifest = JSON.parse(readFileSync(join(args[4], 'package.json'), 'utf8'));
        output = JSON.stringify(manifest[args[2]]);
    } else if (args[0] === 'view') {
        const packageName = args[1].slice(0, args[1].lastIndexOf('@'));
        code = state.published.includes(packageName) ? 0 : 1;
    } else if (args[0] === 'publish') {
        const manifest = JSON.parse(readFileSync(join(args[1], 'package.json'), 'utf8'));
        if (state.published.includes(manifest.name)) code = 1;
        else state.published.push(manifest.name);
    } else throw new Error('Unexpected npm call: ' + JSON.stringify(args));
} else if (name === 'git') {
    if (args[0] === 'branch') output = 'main';
    else if (args[0] === 'status') output = '';
    else if (args[0] === 'rev-parse' && args[1] === 'HEAD') output = 'a'.repeat(40);
    else if (args[0] === 'rev-parse') code = state.localTags.includes(args.at(-1).slice('refs/tags/'.length)) ? 0 : 1;
    else if (args[0] === 'ls-remote') code = state.remoteTags.includes(args.at(-1).slice('refs/tags/'.length)) ? 0 : 2;
    else if (args[0] === 'tag') {
        if (state.localTags.includes(args[1])) code = 1;
        else state.localTags.push(args[1]);
    } else if (args[0] === 'push') {
        if (!state.localTags.includes(args[2]) || state.remoteTags.includes(args[2])) code = 1;
        else state.remoteTags.push(args[2]);
    } else throw new Error('Unexpected git call: ' + JSON.stringify(args));
} else if (name === 'gh') {
    if (args[0] === 'run') output = 'success';
    else if (args[0] === 'release' && args[1] === 'view') code = state.release ? 0 : 1;
    else if (args[0] === 'release' && args[1] === 'create') {
        if (state.release || !state.remoteTags.includes(args[2])) code = 1;
        else {
            state.release = true;
            state.releaseArguments = args;
        }
    } else throw new Error('Unexpected gh call: ' + JSON.stringify(args));
} else if (name !== 'mise' || args.join(' ') !== 'run docs:deploy') {
    throw new Error('Unexpected release command: ' + name + ' ' + JSON.stringify(args));
}
writeFileSync(path, JSON.stringify(state));
if (output !== '') console.log(output);
process.exitCode = code;
`;
