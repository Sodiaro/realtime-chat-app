import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false, // shared in-memory Mongo + single mongoose connection
    hookTimeout: 60000, // first run downloads the mongodb-memory-server binary
    testTimeout: 20000,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-at-least-16-characters",
      MONGODB_URI: "mongodb://127.0.0.1/devchat-test", // placeholder; tests use in-memory
      CLOUDINARY_CLOUD_NAME: "test",
      CLOUDINARY_API_KEY: "test",
      CLOUDINARY_API_SECRET: "test",
      CORS_ORIGIN: "http://localhost:5173",
    },
  },
});
