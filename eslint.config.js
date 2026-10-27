import eslintPluginAstro from "eslint-plugin-astro";
import tsParser from "@typescript-eslint/parser";

export default [
  ...eslintPluginAstro.configs.recommended,
  {
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
    },
  },
  { rules: { "no-console": "error" } },
  // 블로그 스튜디오는 터미널에서 돌리는 로컬 도구라 진행 상황을 콘솔에 찍는다(studio/README.md)
  { files: ["studio/**"], rules: { "no-console": "off" } },
  {
    ignores: ["dist/**", ".astro/**", "public/pagefind/**", ".studio/**"],
  },
];
