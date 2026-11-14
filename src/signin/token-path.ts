// The path at which the development server hands out api's development token, and the local
// build's sign-in asks for it (R44 in docs/decisions.md): one constant for both, and a test of the
// release's build sees that no file of it names the path.

/** The path of the development token on the development server. */
export const LOCAL_TOKEN_PATH = "/__novatrail/custom-token";
