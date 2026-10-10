export const REGISTRY_TIMEOUT_MS = 30_000;

export const RELEASE_NOT_FOUND = 404;

export const RELEASE_ENDPOINTS: Record<string, string> & { github: string } = {
    npm: 'https://registry.npmjs.org/{name}/{version}',
    pypi: 'https://pypi.org/pypi/{name}/{version}/json',
    cargo: 'https://crates.io/api/v1/crates/{name}/{version}',
    github: 'https://api.github.com/repos/{name}/releases/tags/{version}',
};

export const NODE_RELEASES_URL = 'https://nodejs.org/dist/index.json';

export const RUNNER_IMAGES_URL = 'https://api.github.com/repos/actions/runner-images/readme';

export const RUNNER_LABEL = /`([a-z]+-\d+(?:\.\d+)?)`/gu;

export const RETIRED_IMAGE = /preview|deprecated/iu;
