export const FRAMEWORK_FILES = {
    'native/App.jsx':
        'const list = <FlatList data={items} />;\nconst scroll = <ScrollView>{items.map(renderItem)}</ScrollView>;\n',
    'forms/Fields.jsx':
        'const checkbox = <input type="checkbox" value="a" {...register("choice")} />;\nconst radio = <input type="radio" value="a" {...register("choice")} />;\nconst text = <input type="text" value="a" {...register("choice")} />;\n',
    'schema/source.js': 'export const value = 1;\n',
    'app/lib/widget/server.js': 'export const value = 1;\n',
    'app/lib/widget/data.server.js': 'export const value = 1;\n',
    'app/server/data.js': 'export const value = 1;\n',
    'source.js': 'export const value = 1;\n',
};

export const ALL_SECURITY_RULES = [
    'sonarjs/no-os-command-from-path',
    'sonarjs/pseudo-random',
    'sonarjs/no-clear-text-protocols',
    'sonarjs/publicly-writable-directories',
];
export const REMOVED_ZOD_RULES = [
    'zod/prefer-meta',
    'zod/prefer-top-level-string-formats',
    'zod/no-number-schema-with-finite',
];
