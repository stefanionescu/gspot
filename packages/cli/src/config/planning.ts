import { STAGES } from '#cli/config/manifests/names.ts';

export const STAGE_FILTERS = [...STAGES, 'all'] as const;

export const COVERAGE_DIMENSIONS = ['lines', 'branches', 'functions', 'statements'] as const;

export const ROOT_RUNS = ['once', 'history'] as const;

export const COVERAGE_INI_SECTION = /^[\t ]*\[coverage:run\][\t ]*\r?$/mu;

export const LARGE_FILES_CHECK = 'repository/large-files';

export const ENCODING_CHECK = 'repository/encoding';

export const IGNORED_PATHS_MESSAGE = 'every selected path is ignored in gspot.toml';

export const STYLELINT_TOOL = 'stylelint';

export const PRETTIER_TOOL = 'prettier';

export const ADD_REMOVE_MESSAGE = 'Use gspot add or gspot remove to change configurations.';
