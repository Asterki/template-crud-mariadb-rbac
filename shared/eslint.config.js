import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: {
      "no-undef": "off",
      // TODO(P1+): legacy `{}` types, namespaces, any and unused symbols are
      // cleaned up as their files are rewritten in later phases.
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
