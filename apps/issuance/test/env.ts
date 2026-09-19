// Integration tests run against the Aiven test database using the real (git-ignored) env file.
import path from "node:path";

try {
  process.loadEnvFile(path.resolve(__dirname, "../.env.local"));
} catch {
  // Already provided by the environment (e.g. CI).
}
