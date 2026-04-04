import * as vscode from 'vscode';
import { AGENTS_BASE_TEMPLATE } from './agentsPresets';

export type HarnessInitItemId =
  | 'agents'
  | 'doc-arch'
  | 'doc-dev'
  | 'doc-sense'
  | 'design-docs'
  | 'exec-plans'
  | 'lint-deps'
  | 'lint-quality'
  | 'verify'
  | 'validate'
  | 'h-tasks'
  | 'h-trace'
  | 'h-memory';

export interface HarnessInitResult {
  created: string[];
  skipped: string[];
  errors: string[];
}

function rootUri(folder: vscode.WorkspaceFolder): vscode.Uri {
  return folder.uri;
}

function joinRel(folder: vscode.WorkspaceFolder, rel: string): vscode.Uri {
  return vscode.Uri.joinPath(rootUri(folder), ...rel.split('/').filter(Boolean));
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function mkdirpFileParent(folder: vscode.WorkspaceFolder, rel: string): Promise<void> {
  const segments = rel.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return;
  }
  let cur = rootUri(folder);
  for (let i = 0; i < segments.length - 1; i++) {
    cur = vscode.Uri.joinPath(cur, segments[i]);
    try {
      await vscode.workspace.fs.createDirectory(cur);
    } catch {
      /* 已存在或非空 */
    }
  }
}

async function writeIfAbsent(folder: vscode.WorkspaceFolder, rel: string, content: string): Promise<'created' | 'skipped'> {
  const uri = joinRel(folder, rel);
  if (await exists(uri)) {
    return 'skipped';
  }
  await mkdirpFileParent(folder, rel);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
  return 'created';
}

async function mkdirDeep(folder: vscode.WorkspaceFolder, rel: string): Promise<void> {
  const segments = rel.split('/').filter(Boolean);
  let cur = rootUri(folder);
  for (const seg of segments) {
    cur = vscode.Uri.joinPath(cur, seg);
    try {
      await vscode.workspace.fs.createDirectory(cur);
    } catch {
      /* 已存在 */
    }
  }
}

const TPL_ARCH = `# 架构与分层

## 模块边界

（描述主要包 / 目录职责）

## 依赖方向

（例如：上层可依赖下层，禁止反向）

## 禁止事项

- …
`;

const TPL_DEV = `# 开发与验证

## 常用命令

\`\`\`bash
# 安装依赖
# 构建
# 测试
# lint
\`\`\`

## CI

（流水线入口或文档链接）
`;

const TPL_SENSE = `# 业务与产品上下文

## 用户是谁

## 核心场景

## 非目标

- …
`;

const TPL_DIR_README = (title: string) => `# ${title}

（GlueKit 初始化占位：在此目录下添加具体文档或脚本。）
`;

const TPL_LINT_DEPS_SH = `#!/usr/bin/env bash
set -euo pipefail
# GlueKit 占位：层级 / import 方向检查。请按项目语言替换为真实实现（如自定义脚本或调用语言工具链）。
echo "[lint-deps] OK (stub — replace with real checks)"
exit 0
`;

const TPL_LINT_QUALITY_SH = `#!/usr/bin/env bash
set -euo pipefail
# GlueKit 占位：代码质量规则（行数、日志规范等）。请替换为项目实际检查。
echo "[lint-quality] OK (stub — replace with real checks)"
exit 0
`;

const TPL_VALIDATE_PY = `#!/usr/bin/env python3
"""GlueKit 占位：统一验证管道。建议顺序：build → lint-arch → test → verify。"""
import sys

def main() -> int:
    print("[validate] GlueKit harness stub — 请接入项目真实命令链。")
    return 0

if __name__ == "__main__":
    sys.exit(main())
`;

const itemBuilders: Record<
  HarnessInitItemId,
  (folder: vscode.WorkspaceFolder) => Promise<{ created: string[]; skipped: string[]; errors: string[] }>
> = {
  agents: async (folder) => {
    const r = await writeIfAbsent(folder, 'AGENTS.md', AGENTS_BASE_TEMPLATE);
    return r === 'created' ? { created: ['AGENTS.md'], skipped: [], errors: [] } : { created: [], skipped: ['AGENTS.md'], errors: [] };
  },
  'doc-arch': async (folder) => {
    const r = await writeIfAbsent(folder, 'docs/ARCHITECTURE.md', TPL_ARCH);
    return r === 'created'
      ? { created: ['docs/ARCHITECTURE.md'], skipped: [], errors: [] }
      : { created: [], skipped: ['docs/ARCHITECTURE.md'], errors: [] };
  },
  'doc-dev': async (folder) => {
    const r = await writeIfAbsent(folder, 'docs/DEVELOPMENT.md', TPL_DEV);
    return r === 'created'
      ? { created: ['docs/DEVELOPMENT.md'], skipped: [], errors: [] }
      : { created: [], skipped: ['docs/DEVELOPMENT.md'], errors: [] };
  },
  'doc-sense': async (folder) => {
    const r = await writeIfAbsent(folder, 'docs/PRODUCT_SENSE.md', TPL_SENSE);
    return r === 'created'
      ? { created: ['docs/PRODUCT_SENSE.md'], skipped: [], errors: [] }
      : { created: [], skipped: ['docs/PRODUCT_SENSE.md'], errors: [] };
  },
  'design-docs': async (folder) => {
    const created: string[] = [];
    const skipped: string[] = [];
    await mkdirDeep(folder, 'docs/design-docs');
    const r = await writeIfAbsent(folder, 'docs/design-docs/README.md', TPL_DIR_README('design-docs'));
    if (r === 'created') {
      created.push('docs/design-docs/README.md');
    } else {
      skipped.push('docs/design-docs/README.md');
    }
    return { created, skipped, errors: [] };
  },
  'exec-plans': async (folder) => {
    const created: string[] = [];
    const skipped: string[] = [];
    await mkdirDeep(folder, 'docs/exec-plans');
    const r = await writeIfAbsent(folder, 'docs/exec-plans/README.md', TPL_DIR_README('exec-plans'));
    if (r === 'created') {
      created.push('docs/exec-plans/README.md');
    } else {
      skipped.push('docs/exec-plans/README.md');
    }
    return { created, skipped, errors: [] };
  },
  'lint-deps': async (folder) => {
    await mkdirDeep(folder, 'scripts');
    const r = await writeIfAbsent(folder, 'scripts/lint-deps.sh', TPL_LINT_DEPS_SH);
    return r === 'created'
      ? { created: ['scripts/lint-deps.sh'], skipped: [], errors: [] }
      : { created: [], skipped: ['scripts/lint-deps.sh'], errors: [] };
  },
  'lint-quality': async (folder) => {
    await mkdirDeep(folder, 'scripts');
    const r = await writeIfAbsent(folder, 'scripts/lint-quality.sh', TPL_LINT_QUALITY_SH);
    return r === 'created'
      ? { created: ['scripts/lint-quality.sh'], skipped: [], errors: [] }
      : { created: [], skipped: ['scripts/lint-quality.sh'], errors: [] };
  },
  verify: async (folder) => {
    const created: string[] = [];
    const skipped: string[] = [];
    await mkdirDeep(folder, 'scripts/verify');
    const r = await writeIfAbsent(folder, 'scripts/verify/README.md', TPL_DIR_README('verify'));
    if (r === 'created') {
      created.push('scripts/verify/README.md');
    } else {
      skipped.push('scripts/verify/README.md');
    }
    return { created, skipped, errors: [] };
  },
  validate: async (folder) => {
    await mkdirDeep(folder, 'scripts');
    const r = await writeIfAbsent(folder, 'scripts/validate.py', TPL_VALIDATE_PY);
    return r === 'created'
      ? { created: ['scripts/validate.py'], skipped: [], errors: [] }
      : { created: [], skipped: ['scripts/validate.py'], errors: [] };
  },
  'h-tasks': async (folder) => {
    await mkdirDeep(folder, 'harness/tasks');
    const r = await writeIfAbsent(folder, 'harness/tasks/.gitkeep', '\n');
    return r === 'created'
      ? { created: ['harness/tasks/.gitkeep'], skipped: [], errors: [] }
      : { created: [], skipped: ['harness/tasks/.gitkeep'], errors: [] };
  },
  'h-trace': async (folder) => {
    await mkdirDeep(folder, 'harness/trace');
    const r = await writeIfAbsent(folder, 'harness/trace/.gitkeep', '\n');
    return r === 'created'
      ? { created: ['harness/trace/.gitkeep'], skipped: [], errors: [] }
      : { created: [], skipped: ['harness/trace/.gitkeep'], errors: [] };
  },
  'h-memory': async (folder) => {
    await mkdirDeep(folder, 'harness/memory');
    const r = await writeIfAbsent(folder, 'harness/memory/.gitkeep', '\n');
    return r === 'created'
      ? { created: ['harness/memory/.gitkeep'], skipped: [], errors: [] }
      : { created: [], skipped: ['harness/memory/.gitkeep'], errors: [] };
  },
};

export const HARNESS_INIT_ORDER: HarnessInitItemId[] = [
  'agents',
  'doc-arch',
  'doc-dev',
  'doc-sense',
  'design-docs',
  'exec-plans',
  'lint-deps',
  'lint-quality',
  'verify',
  'validate',
  'h-tasks',
  'h-trace',
  'h-memory',
];

function mergeResults(a: HarnessInitResult, b: HarnessInitResult): HarnessInitResult {
  return {
    created: [...a.created, ...b.created],
    skipped: [...a.skipped, ...b.skipped],
    errors: [...a.errors, ...b.errors],
  };
}

export async function ensureHarnessInitItem(
  folder: vscode.WorkspaceFolder,
  id: string
): Promise<HarnessInitResult> {
  const key = id as HarnessInitItemId;
  const fn = itemBuilders[key];
  if (!fn) {
    return { created: [], skipped: [], errors: [`未知项：${id}`] };
  }
  try {
    return await fn(folder);
  } catch (e) {
    return { created: [], skipped: [], errors: [String(e)] };
  }
}

/** 仅创建尚不存在的路径；不覆盖已有文件 */
export async function ensureHarnessInitAll(folder: vscode.WorkspaceFolder): Promise<HarnessInitResult> {
  let acc: HarnessInitResult = { created: [], skipped: [], errors: [] };
  for (const id of HARNESS_INIT_ORDER) {
    acc = mergeResults(acc, await ensureHarnessInitItem(folder, id));
  }
  return acc;
}

const TPL_REFERENCE_README = `# reference 物料库（Glue）

本目录存放**可复制、可引用**的范式片段、团队约定与示例说明。根目录的 \`AGENTS.md\` 只做**短索引**，细节按需拆成多个 Markdown 放在此处。

## 使用方式

- 在 Cursor Chat 中用 \`@reference/某文件.md\` 引用。
- 与 **Harness**：Harness 负责整仓建议布局（含 \`AGENTS.md\` 初始化）；Glue 页负责日常打开物料与「@引用」——**指向同一文件，没有第二份 AGENTS**。

## 可选文档（按需增删）

| 文件 | 建议内容 |
|------|----------|
| \`coding-style.md\` | 命名、格式、目录约定 |
| \`api-patterns.md\` | 接口风格、错误码 |
| \`snippets.md\` | 常用提示词或代码片段 |

> 扫描同时匹配 \`reference/**\` 与 \`references/**\`；若团队惯用复数目录，可自行建 \`references/\` 并迁移。
`;

/** Glue「reference 物料库」：创建 \`reference/README.md\`（不存在时），不覆盖 */
export async function ensureReferenceLibrary(folder: vscode.WorkspaceFolder): Promise<HarnessInitResult> {
  try {
    const r = await writeIfAbsent(folder, 'reference/README.md', TPL_REFERENCE_README);
    return r === 'created'
      ? { created: ['reference/README.md'], skipped: [], errors: [] }
      : { created: [], skipped: ['reference/README.md'], errors: [] };
  } catch (e) {
    return { created: [], skipped: [], errors: [String(e)] };
  }
}
