import { execSync } from "child_process";
import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });

// 显示当前 tag 列表
console.log("\n当前 git tag 列表：");
try {
  const tags = execSync('git tag --sort=-v:refname', { encoding: "utf-8" }).trim();
  console.log(tags || "（无）");
} catch {
  console.log("（无）");
}
console.log();

rl.question("请输入版本号（如 0.5.0）：", (version) => {
  rl.close();

  if (!version.trim()) {
    console.error("版本号不能为空");
    process.exit(1);
  }

  const tag = `v${version.trim()}`;

  try {
    execSync(`git tag -a ${tag} -m "更新版本"`, { stdio: "inherit" });
    execSync(`git push origin ${tag}`, { stdio: "inherit" });
    console.log(`\n✓ 已创建并推送 ${tag}`);
  } catch {
    console.error(`\n✗ 操作失败`);
    process.exit(1);
  }
});
