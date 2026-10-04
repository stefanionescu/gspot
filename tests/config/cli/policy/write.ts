/** Authored comments, table layout, and a schema directive kept across policy edits. */
export const AUTHORED_POLICY =
    '#:schema x\n\n# Comment on configurations.\nconfigurations = ["bash"]\n\n[hooks]\n# gspot checks the changed paths of a push.\npush_files = "changed"\n';
