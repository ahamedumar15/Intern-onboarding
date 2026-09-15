import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

// Named, not an anonymous array literal: `import/no-anonymous-default-export`
// warns otherwise, and NFR-3's gate is only credible if the log is empty.
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "prisma/migrations/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // NFR-3: zero `any` in the codebase, tests included.
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["error", "smart"],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // ADR-001: the business logic stays framework-agnostic so it is testable
    // without a Next.js harness and portable off Next.js later.
    files: ["src/server/**/*.ts", "src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*"],
              message:
                "src/server and src/lib must stay framework-agnostic (ADR-001). Keep next/* imports in src/app/**.",
            },
          ],
        },
      ],
    },
  },
  {
    // The logger is the one place allowed to write to stdout (NFR-7).
    files: ["src/lib/logger.ts", "prisma/seed.ts", "scripts/**"],
    rules: { "no-console": "off" },
  },
];

export default config;
