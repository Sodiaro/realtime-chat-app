import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 60000, // bcrypt-heavy auth tests can run long under machine load
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-at-least-16-characters",
      MONGODB_URI: "mongodb://127.0.0.1/devchat-test",
      CLOUDINARY_CLOUD_NAME: "test",
      CLOUDINARY_API_KEY: "test",
      CLOUDINARY_API_SECRET: "test",
      CORS_ORIGIN: "http://localhost:5173",
    },
  },
});
