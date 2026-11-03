import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{40,}/, /AKIA[0-9A-Z]{16}/, /sk_live_[A-Za-z0-9]{20,}/];
const bad = [];
for (const file of new Set(files)) {
  if (!existsSync(file) || file === "scripts/check-secrets.mjs") continue;
  const text = readFileSync(file, "utf8");
  if (patterns.some(p => p.test(text))) bad.push(file);
}
if (bad.length) { console.error("Possível segredo em:", bad.join(", ")); process.exit(1); }
console.log("Nenhum segredo detectado pelos padrões verificados nos arquivos do projeto.");
