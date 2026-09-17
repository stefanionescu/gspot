import type { Files } from '@config/tests/repositories'

const X = 'x\n'
const SQL = 'select 1;\n'

export const BARE_DIRECTORY: Files = {
  '.gitignore': 'build/\nreports/\ntmp/\nvendor/\nnode_modules/\ncoverage/\ndist/\nsql/\n',
  'sql/schema.sql': SQL,
  'tests/suites/sql/rls/versioning.test.sql': SQL,
  'src/remote/teardown/sql/drop.sql': SQL,
  'src/remote/ops/cron/user-deletion.sql': SQL,
  'ops/vault-secrets/set-secret.sql': SQL,
}

export const IGNORE_IDIOMS: Readonly<Record<string, Files>> = {
  'bare-directory': BARE_DIRECTORY,
  'trailing-slash': {
    '.gitignore': 'build/\ncache\n',
    'build/output.js': X,
    'build.js': X,
    'cache/entry.bin': X,
    'cache.txt': X,
    'deep/build/output.js': X,
  },
  'leading-slash': {
    '.gitignore': '/dist\nnode_modules\n',
    'dist/app.js': X,
    'packages/api/dist/app.js': X,
    'node_modules/left-pad/index.js': X,
    'packages/api/node_modules/left-pad/index.js': X,
  },
  negation: {
    '.gitignore': '*.log\n!keep.log\nsecret/\n!secret/keep.txt\n',
    'run.log': X,
    'keep.log': X,
    'nested/keep.log': X,
    'secret/keep.txt': X,
    'secret/drop.txt': X,
  },
  'double-star': {
    '.gitignore': 'a/**/z.txt\n**/generated/**\nb/*/c.txt\n',
    'a/z.txt': X,
    'a/m/z.txt': X,
    'a/m/n/z.txt': X,
    'pkg/generated/types.ts': X,
    'generated/types.ts': X,
    'b/one/c.txt': X,
    'b/one/two/c.txt': X,
  },
  'character-class': {
    '.gitignore': '*.[oa]\nfile[0-9].txt\nname[!0-9].txt\n',
    'main.o': X,
    'main.a': X,
    'main.c': X,
    'file3.txt': X,
    'filex.txt': X,
    'namex.txt': X,
    'name7.txt': X,
  },
  'extension-glob': {
    '.gitignore': '*.min.js\n*.map\n',
    'web/app.min.js': X,
    'web/app.js': X,
    'deep/nested/vendor.min.js': X,
    'web/app.js.map': X,
  },

  'case-sensitivity': {
    '.gitignore': 'readme.md\nLICENCE\n',
    'README.md': X,
    'docs/readme.md': X,
    LICENCE: X,
    'licence.txt': X,
  },
}
