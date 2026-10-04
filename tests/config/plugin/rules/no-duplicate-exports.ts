/** Source modules whose explicit exports and cycles are checked by the rule. */
export const EXPORT_FILES = {
    'tsconfig.json': '{"compilerOptions":{"baseUrl":".","paths":{"@app/*":["./*.ts"]}},"include":["*.ts"]}',
    'index.ts': '',
    'defaults.ts': 'const value = 1; export {value as default};',
    'a.ts': 'export const one = 1;\nexport const two = 2;\n',
    'b.ts': 'export const two = 22;\nexport function three() {}\n',
    'bindings.ts':
        'export const first = 1, second = 2; export const {one: renamed, nested: [deep], ...rest} = value; export const [head, , ...tail] = value;',
    'comments.ts': '// export const one = 1;\n/* export {two}; */ export const real = 1;',
    'cycle.ts': "export * from './cycle'; export * from './c'; export * as group from './a'; export default 1;",
    'c.ts': "export * from './a';\n",
};
