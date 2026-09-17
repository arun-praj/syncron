import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["node_modules/**", "drizzle/**", "apps/extension/.output/**", "apps/extension/.wxt/**"] },
  ...tseslint.configs.recommended,
);
