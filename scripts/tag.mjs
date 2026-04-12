import { execSync } from "child_process";
import { createInterface } from "readline";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

// 读取 package.json 中的当前版本号
function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"));
  return pkg.version;
}

// 获取最新的 git tag 版本号（去掉 v 前缀）
function getLatestTagVersion() {
  try {
    const tags = execSync("git tag --sort=-v:refname", { encoding: "utf-8" }).trim();
    if (!tags) return null;
    const latest = tags.split("\n")[0].trim();
    return latest.replace(/^v/, "");
  } catch {
    return null;
  }
}

// Semver 比较：a > b 返回正数，a < b 返回负数，相等返回 0
function compareSemver(a, b) {
  const parse = (v) => {
    const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) return null;
    return { major: +match[1], minor: +match[2], patch: +match[3], pre: match[4] || null };
  };
  const va = parse(a);
  const vb = parse(b);
  if (!va || !vb) return 0;
  for (const key of ["major", "minor", "patch"]) {
    if (va[key] !== vb[key]) return va[key] - vb[key];
  }
  if (va.pre && !vb.pre) return -1;
  if (!va.pre && vb.pre) return 1;
  if (va.pre && vb.pre) return va.pre.localeCompare(vb.pre);
  return 0;
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// --- 主流程 ---

const currentVersion = getCurrentVersion();
const latestTag = getLatestTagVersion();

console.log(`\n当前版本: ${currentVersion}`);
console.log(`最新 tag: ${latestTag ? `v${latestTag}` : "（无）"}`);

// 检查当前版本是否大于最新 tag
if (latestTag && compareSemver(currentVersion, latestTag) <= 0) {
  console.log(`\n❌ 当前版本 ${currentVersion} 未超过最新 tag v${latestTag}`);
  console.log("请先运行 npm run set-version 提升版本号，再执行 tag 命令。");
  process.exit(1);
}

const tag = `v${currentVersion}`;
const answer = await ask(`\n是否创建并推送 tag ${tag}？(y/N) `);

if (answer.toLowerCase() !== "y") {
  console.log("已取消。");
  process.exit(0);
}

try {
  execSync(`git tag -a ${tag} -m "v${currentVersion}"`, { stdio: "inherit" });
  execSync(`git push origin ${tag}`, { stdio: "inherit" });
  console.log(`\n✅ 已创建并推送 ${tag}`);
} catch {
  console.error("\n❌ 操作失败");
  process.exit(1);
}
