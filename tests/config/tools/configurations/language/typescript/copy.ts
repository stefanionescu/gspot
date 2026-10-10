export const TYPESCRIPT_COPY_FILES = {
    '.gitignore': 'node_modules/\n.venv/\n.gspot/\n',
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json': '{"files":[],"references":[{"path":"app"}]}',
    'app/tsconfig.json': '{"extends":"../config/base.json","include":["src/**/*.ts"]}',
    'config/base.json':
        '{"compilerOptions":{"composite":true,"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]}}',
    'app/src/main.ts': 'import type { Value } from "../shared/value.js"; export const port: Value = "wrong";\n',
    'app/shared/value.d.ts': 'export type Value = number;\n',
    'neighbor/source.ts': 'export const ignored: number = "wrong";\n',
    'neighbor/node_modules/unrelated/package.json': '{"name":"unrelated","version":"1.0.0"}',
    'neighbor/.venv/pyvenv.cfg': 'home = unrelated\n',
};
