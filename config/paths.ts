export const SETTINGS_FILE = 'gspot.toml'
export const LOCAL_SETTINGS_FILE = 'gspot.local.toml'

export const GSPOT_DIRECTORY = '.gspot'
export const GENERATED_DIRECTORY = `${GSPOT_DIRECTORY}/generated`
export const BIN_DIRECTORY = `${GSPOT_DIRECTORY}/bin`
export const BIN_CACHE_DIRECTORY = `${BIN_DIRECTORY}/.cache`
export const HOOKS_DIRECTORY = `${GSPOT_DIRECTORY}/hooks`
export const BASELINE_DIRECTORY = `${GSPOT_DIRECTORY}/baseline`
export const RUN_DIRECTORY = `${GSPOT_DIRECTORY}/run`

export const COVERAGE_PATH = `${GSPOT_DIRECTORY}/coverage.json`
export const LOCK_PATH = `${GSPOT_DIRECTORY}/tools.lock`
export const LATEST_RUN_PATH = `${RUN_DIRECTORY}/latest.json`
export const LATEST_SARIF_PATH = `${RUN_DIRECTORY}/latest.sarif`

export const PRESET_MANIFEST_NAME = 'manifest.toml'

export const MANAGED_FILES = [
  '.gitignore',
  '.gitattributes',
  '.prettierignore',
  'CLAUDE.md',
  'AGENTS.md',
]

export const AGENT_INDEX_FILES = ['CLAUDE.md', 'AGENTS.md']
