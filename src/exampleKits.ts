import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ensureHarnessInitAll, ensureHarnessInitItem, ensureReferenceLibrary } from './harnessInit';

export type ScaffoldKind = 'spec' | 'glue' | 'harness';

export function parseScaffoldKind(raw: string): ScaffoldKind | null {
  if (raw === 'spec' || raw === 'glue' || raw === 'harness') {
    return raw;
  }
  return null;
}

export interface ScaffoldResult {
  rootRel: string;
  created: string[];
  errors: string[];
}

function subWorkspaceFolder(root: vscode.WorkspaceFolder, rootName: string): vscode.WorkspaceFolder {
  return {
    uri: vscode.Uri.joinPath(root.uri, rootName),
    name: rootName,
    index: root.index,
  };
}

async function existsUri(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function rand4(): string {
  return crypto.randomBytes(2).toString('hex');
}

async function writeRelToWorkspace(folder: vscode.WorkspaceFolder, rel: string, content: string): Promise<void> {
  const segments = rel.split('/').filter(Boolean);
  let cur = folder.uri;
  for (let i = 0; i < segments.length - 1; i++) {
    cur = vscode.Uri.joinPath(cur, segments[i]);
    try {
      await vscode.workspace.fs.createDirectory(cur);
    } catch {
      /* 已存在 */
    }
  }
  const fileUri = vscode.Uri.joinPath(folder.uri, ...segments);
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
}

async function pickUniqueRootName(folder: vscode.WorkspaceFolder, kindTag: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const name = `gluekit-scaffold-${kindTag}-${stamp()}-${rand4()}`;
    const uri = vscode.Uri.joinPath(folder.uri, name);
    if (!(await existsUri(uri))) {
      return name;
    }
  }
  throw new Error('无法生成唯一脚手架目录名，请稍后重试');
}

const SPEC_KIT_README = `# GlueKit 脚手架（Spec Coding）

本目录由 **示例参考 → 创建** 生成，目录名含 **日期时间 + 随机后缀**，可多次创建且不会覆盖旧目录。

## 内容

- \`proposals/sample/proposal.md\`：Proposal 试写模板  
- \`specs/sample/feature-spec.md\`：Spec 草稿，frontmatter 已填 \`derived_from\` 指向上游 Proposal  

完成后可将文件迁入仓库正式的 \`proposals/<特性>/\`、\`specs/<特性>/\`，或删除本试写目录。
`;

const GLUE_KIT_README = `# GlueKit 脚手架（Glue Coding）

本目录侧重 **Agent 侧**：根级 \`AGENTS.md\` 导航索引与 \`reference/\` 物料库占位。

可与「Harness 脚手架」同仓并存；Harness 负责整仓建议布局时，也可把本目录当作独立试写沙箱后再合并。

目录名含时间戳与随机后缀，支持重复创建。
`;

const HARNESS_KIT_README = `# GlueKit 脚手架（Harness）

本目录内为 GlueKit **建议 Harness 布局** 的完整占位（\`docs/\`、\`scripts/\`、\`harness/\` 等），**不覆盖**已存在文件；新目录下会全部新建。

与仓库根目录的 Harness 初始化等价，但隔离在独立子目录中，便于演练或多套并行。目录名含随机后缀，可重复创建。
`;

const TPL_PROPOSAL_SAMPLE = `---
title: "示例特性"
status: draft
author: ""
reviewers: []
related_specs: []
tags: []
---

# 背景与问题陈述

（简述业务场景与待解决问题。）

# 目标与成功标准

## 目标

- 

## 非目标

- 

## 成功标准

| 指标 | 当前 | 目标 |
|------|------|------|
|  |  |  |

# 范围与风险

- **In Scope**：
- **主要风险**：

# 门禁清单（Proposal 阶段）

- [ ] 目标与非目标已对齐
- [ ] 成功标准可度量
`;

function tplSpecSample(proposalRel: string): string {
  return `---
title: "示例 Spec"
status: draft
derived_from: ${proposalRel}
gluekit_material: []
parent_proposal: ""
owners: []
---

# 概述

（对应 Proposal：\`${proposalRel}\`）

# 用户故事

- 作为 **用户**，我希望 **…**，以便 **…**。

# 需求说明

| ID | 描述 | 优先级 |
|----|------|--------|
| FR-1 |  | P0 |

# 验收标准（AC）

- [ ] **AC-1**：
- [ ] **AC-2**：

# 修订记录

| 版本 | 说明 |
|------|------|
| 0.1 | 脚手架初稿 |
`;
}

const TPL_GLUE_SNIPPETS = `# 片段与提示词（Glue）

在此追加团队常用 Cursor 提示词、代码范式说明等；根目录 \`AGENTS.md\` 可链到本文件。
`;

/** 在工作区根下新建独立子目录并写入脚手架；每次使用新的目录名，不覆盖已有路径 */
export async function createScaffoldKit(folder: vscode.WorkspaceFolder, kind: ScaffoldKind): Promise<ScaffoldResult> {
  const errors: string[] = [];
  const created: string[] = [];
  const kindTag = kind === 'spec' ? 'spec' : kind === 'glue' ? 'glue' : 'harness';

  try {
    const rootName = await pickUniqueRootName(folder, kindTag);
    const rootUri = vscode.Uri.joinPath(folder.uri, rootName);
    await vscode.workspace.fs.createDirectory(rootUri);

    if (kind === 'spec') {
      const propRel = `${rootName}/proposals/sample/proposal.md`;
      const specRel = `${rootName}/specs/sample/feature-spec.md`;
      await writeRelToWorkspace(folder, `${rootName}/README.md`, SPEC_KIT_README);
      await writeRelToWorkspace(folder, propRel, TPL_PROPOSAL_SAMPLE);
      await writeRelToWorkspace(folder, specRel, tplSpecSample(propRel));
      created.push(`${rootName}/README.md`, propRel, specRel);
      return { rootRel: rootName, created, errors };
    }

    const sub = subWorkspaceFolder(folder, rootName);

    if (kind === 'glue') {
      const ag = await ensureHarnessInitItem(sub, 'agents');
      const rf = await ensureReferenceLibrary(sub);
      errors.push(...ag.errors, ...rf.errors);
      for (const p of ag.created) {
        created.push(`${rootName}/${p}`);
      }
      for (const p of rf.created) {
        created.push(`${rootName}/${p}`);
      }
      const snipUri = vscode.Uri.joinPath(sub.uri, 'reference', 'snippets.md');
      if (!(await existsUri(snipUri))) {
        await writeRelToWorkspace(folder, `${rootName}/reference/snippets.md`, TPL_GLUE_SNIPPETS);
        created.push(`${rootName}/reference/snippets.md`);
      }
      await writeRelToWorkspace(folder, `${rootName}/README.md`, GLUE_KIT_README);
      created.push(`${rootName}/README.md`);
      return { rootRel: rootName, created, errors };
    }

    const har = await ensureHarnessInitAll(sub);
    errors.push(...har.errors);
    for (const p of har.created) {
      created.push(`${rootName}/${p}`);
    }
    await writeRelToWorkspace(folder, `${rootName}/README.md`, HARNESS_KIT_README);
    created.push(`${rootName}/README.md`);
    return { rootRel: rootName, created, errors };
  } catch (e) {
    errors.push(String(e));
    return { rootRel: '', created, errors };
  }
}
