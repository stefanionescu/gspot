export const SELECTOR_FILES = {
    'native/App.jsx': `const list = <FlatList data={items} />;
const scroll = <ScrollView>{items.map(renderItem)}</ScrollView>;
`,
    'forms/Fields.jsx': `const checkbox = <input type="checkbox" value="a" {...register("choice")} />;
const radio = <input type="radio" value="a" {...register("choice")} />;
const text = <input type="text" value="a" {...register("choice")} />;
`,
} as const;
