export const SELECTOR_FILES = {
    'native/App.jsx':
        'const list = <FlatList data={items} />;\nconst scroll = <ScrollView>{items.map(renderItem)}</ScrollView>;\n',
    'forms/Fields.jsx': `const checkbox = <input type="checkbox" value="a" {...register("choice")} />;
const radio = <input type="radio" value="a" {...register("choice")} />;
const text = <input type="text" value="a" {...register("choice")} />;
`,
} as const;

export const SELECTOR_LIBRARY_FILES = {
    'cart.js':
        "import { useStore } from 'zustand';\nimport { cartStore, useCartStore } from './store.js';\nexport function readCart() {\n    const whole = useCartStore();\n    const all = useStore(cartStore);\n    return [whole, all];\n}\n",
    'form.js':
        "import { useForm } from 'react-hook-form';\nconst options = { resolver: schema };\nexport function useSignup() { return useForm(options); }\n",
    'router.js':
        'const byId = publicProcedure.input(schema);\nexport const appRouter = router({\n    item: byId.query(resolve),\n    order: publicProcedure.input(schema).query(({ input }) => pool.query(sql)),\n});\n',
} as const;
