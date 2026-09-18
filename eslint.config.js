import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "drizzle/**",
      "apps/extension/.output/**",
      "apps/extension/.wxt/**",
      // Stray Plasmo build/cache output left at the repo root from before
      // the WXT migration. Untracked and gitignored; couldn't be deleted
      // in this environment (recursive rm is blocked here), so it's
      // excluded from lint instead.
      "build/**",
      ".plasmo/**",
    ],
  },
  ...tseslint.configs.recommended,
);
