import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...vue.configs["flat/recommended"],
  {
    languageOptions: {
      parserOptions: {
        extraFileExtensions: [
          ".vue"
        ],
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: [
      "**/*.vue"
    ],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: "latest",
        extraFileExtensions: [
          ".vue"
        ],
        parser: tseslint.parser,
        projectService: true,
        sourceType: "module",
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: [
      "**/*.spec.ts"
    ],
    rules: {
      "@typescript-eslint/require-await": "off"
    }
  },
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "apps/api/src/generated/**",
      "apps/web/dist/**"
    ]
  }
);
