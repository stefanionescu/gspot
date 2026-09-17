export const CANONICAL_TASKS = [
  'setup',
  'generate',
  'coverage',
  'format',
  'format:check',
  'lint',
  'lint:prose',
  'lint:docs',
  'typecheck',
  'test',
  'security',
  'licenses',
  'dependencies',
  'check',
  'fix',
  'hook:pre-commit',
  'hook:pre-push',
  'hook:commit-msg',
]

export const MISE_TASK_SUBTREE = 'gspot'

export const MISE_DEFAULT_TASK_DIRECTORY = '.mise/tasks'

export const MISE_REQUIRED_SETTINGS = [
  '[settings]',
  'not_found_auto_install = false',
  '',
  '[settings.task]',
  'run_auto_install = false',
]
