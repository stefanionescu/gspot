export const PUSH_CHECK_ARGV = ['check', '--hook', 'pre-push', '--only', 'bash/syntax', '--json', '--'];

export const PUSH_CHECK_COMMAND = [...PUSH_CHECK_ARGV, 'origin', 'unused'];
