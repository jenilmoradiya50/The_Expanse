import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

function getFileHash(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const rootDir = path.resolve(__dirname, "..");
const devDbPath = path.join(rootDir, "prisma", "dev.db");
const testDbPath = path.join(rootDir, "prisma", "test.db");
const backupDbPath = path.join(rootDir, "prisma", "backups", "dev_20261031_0937.db");

console.log("[TEST_RUNNER] Initializing dedicated SQLite test database...");

// 1. Record pre-test hash of prisma/dev.db
const preTestDevHash = getFileHash(devDbPath);
console.log(`[TEST_RUNNER] dev.db initial hash: ${preTestDevHash.substring(0, 16)}...`);

// 2. Ensure test.db is prepared from clean baseline
if (!fs.existsSync(testDbPath)) {
  if (fs.existsSync(backupDbPath)) {
    fs.copyFileSync(backupDbPath, testDbPath);
    console.log("[TEST_RUNNER] test.db initialized from verified baseline backup.");
  } else if (fs.existsSync(devDbPath)) {
    fs.copyFileSync(devDbPath, testDbPath);
    console.log("[TEST_RUNNER] test.db initialized from dev.db snapshot.");
  }
}

// 3. Execute test suite with strictly isolated test database environment
console.log("[TEST_RUNNER] Executing test suite against prisma/test.db...");
const testArgs = process.argv.slice(2);
const defaultArgs = ["--test", "tests/**/*.test.ts"];
const runnerArgs = testArgs.length > 0 ? testArgs : defaultArgs;

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCmd, ["tsx", ...runnerArgs], {
  cwd: rootDir,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: "file:./test.db",
    TEST_DATABASE_URL: "file:./test.db",
  },
});

// 4. Verify dev.db was not modified
const postTestDevHash = getFileHash(devDbPath);
if (preTestDevHash && preTestDevHash !== postTestDevHash) {
  console.error("CRITICAL ERROR: prisma/dev.db was modified during automated test execution!");
  process.exit(1);
} else {
  console.log(`[TEST_RUNNER] Verification PASSED: prisma/dev.db hash is identical (${preTestDevHash.substring(0, 16)}...).`);
}

process.exit(result.status ?? 0);
