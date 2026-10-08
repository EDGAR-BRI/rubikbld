import fs from "node:fs";
import path from "node:path";

const hooksDir = path.resolve(".git/hooks");

const nodeEnvLoader = `# Cargar PATH común de Node (nvm, fnm, brew, volta, asdf) por si el entorno GUI no lo tiene
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

if ! command -v node >/dev/null 2>&1; then
  for p in "$HOME/.nvm/versions/node"/*/"bin" "$HOME/.fnm/current/bin" "$HOME/.asdf/shims" "$HOME/.volta/bin" /usr/local/bin /usr/bin; do
    if [ -x "$p/node" ]; then
      export PATH="$p:$PATH"
      break
    fi
  done
fi
`;

const preCommitContent = `#!/usr/bin/env bash
${nodeEnvLoader}
if [ -f "scripts/auto-version-hook.mjs" ]; then
  exec node scripts/auto-version-hook.mjs --pre-commit
elif [ -f "scripts/auto-version-hook.js" ]; then
  exec node scripts/auto-version-hook.js --pre-commit
fi
`;

const commitMsgContent = `#!/usr/bin/env bash
${nodeEnvLoader}
if [ -f "scripts/auto-version-hook.mjs" ]; then
  exec node scripts/auto-version-hook.mjs --commit-msg "$1"
elif [ -f "scripts/auto-version-hook.js" ]; then
  exec node scripts/auto-version-hook.js --commit-msg "$1"
fi
`;

const postCommitContent = `#!/usr/bin/env bash
${nodeEnvLoader}
if [ -f "scripts/auto-version-hook.mjs" ]; then
  exec node scripts/auto-version-hook.mjs --post-commit
elif [ -f "scripts/auto-version-hook.js" ]; then
  exec node scripts/auto-version-hook.js --post-commit
fi
`;

try {
  if (fs.existsSync(hooksDir)) {
    fs.writeFileSync(path.resolve(hooksDir, "pre-commit"), preCommitContent, { mode: 0o755 });
    fs.writeFileSync(path.resolve(hooksDir, "commit-msg"), commitMsgContent, { mode: 0o755 });
    fs.writeFileSync(path.resolve(hooksDir, "post-commit"), postCommitContent, { mode: 0o755 });
    console.log("✓ [AutoVersion] Hooks pre-commit, commit-msg y post-commit instalados en .git/hooks/");
  }
} catch (e) {}
