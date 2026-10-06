/** Sources that distinguish native text components from raw text in a view. */
export const TEXT_COMPONENTS = {
    'src/Label.jsx': 'export const Label = () => <ThemedText>label</ThemedText>;\n',
    'src/Raw.jsx': 'export const Raw = () => <View>label</View>;\n',
    'src/Native.jsx': 'export const Native = () => <Text>label</Text>;\n',
};

/** Scoped React Native and Expo projects sharing no framework configuration. */
export const MOBILE_POLICY = `configurations = ["javascript"]
[[scope]]
path = "bare"
configurations = ["react-native"]
[[scope]]
path = "expo-app"
configurations = ["expo"]
[agent_rules]
enabled = false
`;
