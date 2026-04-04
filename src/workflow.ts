import * as path from 'path';
import * as vscode from 'vscode';
import { parseMarkdownFrontmatter, setFrontmatterField } from './frontmatterUtil';
import type { WorkbenchState } from './state';
import { loadState, saveState } from './state';

function root(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

function relUri(rel: string): vscode.Uri | undefined {
  const r = root();
  if (!r || rel.includes('..')) {
    return undefined;
  }
  return vscode.Uri.joinPath(r, ...rel.split('/').filter(Boolean));
}

export async function readWorkspaceFile(rel: string): Promise<string | undefined> {
  const uri = relUri(rel);
  if (!uri) {
    return undefined;
  }
  try {
    const buf = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(buf).toString('utf8');
  } catch {
    return undefined;
  }
}

export async function writeWorkspaceFile(rel: string, content: string): Promise<boolean> {
  const uri = relUri(rel);
  if (!uri) {
    return false;
  }
  try {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    return true;
  } catch {
    return false;
  }
}

/** Proposal 门禁通过（仅存状态，不改 Proposal 文件） */
export async function setProposalGatePassed(rel: string, passed: boolean): Promise<void> {
  const s = await loadState();
  const g = { ...(s.proposalGate || {}) };
  if (passed) {
    g[rel] = { passed: true, passedAt: new Date().toISOString() };
  } else {
    delete g[rel];
  }
  await saveState({ ...s, proposalGate: g });
}

/** Spec v1.0 门禁通过 */
export async function setSpecGatePassed(rel: string, passed: boolean): Promise<void> {
  const s = await loadState();
  const g = { ...(s.specGate || {}) };
  if (passed) {
    g[rel] = { passed: true, passedAt: new Date().toISOString() };
  } else {
    delete g[rel];
  }
  await saveState({ ...s, specGate: g });
}

/** 冻结 Spec：将 frontmatter status 改为 frozen */
export async function freezeSpec(rel: string): Promise<string | undefined> {
  const text = await readWorkspaceFile(rel);
  if (text === undefined) {
    return '无法读取文件';
  }
  const next = setFrontmatterField(text, 'status', 'frozen');
  const ok = await writeWorkspaceFile(rel, next);
  if (!ok) {
    return '写入失败';
  }
  const s = await loadState();
  const fs = new Set(s.frozenSpecs || []);
  fs.add(rel);
  await saveState({ ...s, frozenSpecs: [...fs] });
  void vscode.window.showInformationMessage(`GlueKit：已冻结 ${rel}（status: frozen）`);
  return undefined;
}

export function isProposalGatePassed(state: WorkbenchState, rel: string): boolean {
  return !!state.proposalGate?.[rel]?.passed;
}

/** Proposal 页人工自检项（与 Webview 常量 id 一致） */
export const PROPOSAL_SELF_CHECK_IDS = ['prop-a', 'prop-b', 'prop-c', 'prop-d'] as const;

export function proposalSelfChecksComplete(state: WorkbenchState, rel: string): boolean {
  const row = state.proposalSelfChecks?.[rel];
  if (!row) {
    return false;
  }
  return PROPOSAL_SELF_CHECK_IDS.every((id) => row[id] === true);
}

/** 供复制到 Cursor Chat：根据 Proposal 全文生成 Spec 的提示词 */
export async function buildProposalToSpecAiPrompt(proposalRel: string): Promise<string> {
  const raw = (await readWorkspaceFile(proposalRel)) ?? '';
  const specRel = deriveSpecPathFromProposal(proposalRel);
  const max = 14000;
  const body = raw.length > max ? `${raw.slice(0, max)}\n\n…（正文已截断，生成前请在编辑器中打开 Proposal 全文核对。）` : raw;
  return `你是本仓库的 Spec 作者。请根据下面这份 **Proposal** 撰写或补全 **Spec 草稿**（Markdown）。

## 输出要求
- 建议保存路径：\`${specRel}\`（若仓库另有约定可调整目录，但请保留 \`derived_from: ${proposalRel}\` 语义）。
- frontmatter 含：title、status: draft、derived_from: ${proposalRel}、spec_version（如 1.0-draft）。
- 正文须包含：**概述**、**方案要点**、**验收标准（AC）**（可勾选条目）、**风险与开放问题**。
- 不要编造仓库中不存在的路径或命令；不确定处用「待确认」占位。

## 下一步（人工）
- 在 GlueKit「Spec」页与「门禁与拆分」中做 **Spec v1.0 门禁**自检，通过后 **冻结** Spec，再考虑 **拆分**（需求 / 设计 / 任务三文件）。

## Proposal：${proposalRel}

\`\`\`markdown
${body}
\`\`\`
`;
}

export function isSpecGatePassed(state: WorkbenchState, rel: string): boolean {
  return !!state.specGate?.[rel]?.passed;
}

export async function isSpecFrozen(rel: string): Promise<boolean> {
  const t = await readWorkspaceFile(rel);
  if (t === undefined) {
    return false;
  }
  const st = parseMarkdownFrontmatter(t).fields['status']?.toLowerCase();
  return st === 'frozen' || st === 'v1.0-frozen';
}

export async function canSplitSpec(state: WorkbenchState, rel: string): Promise<boolean> {
  if (!isSpecGatePassed(state, rel)) {
    return false;
  }
  return isSpecFrozen(rel);
}

/** 拆分输出目录：与 Spec 同父目录下建 krio-{stem}/（Kiro 风格三文件） */
export function splitOutputDir(specRel: string): string {
  const norm = specRel.replace(/\\/g, '/');
  const dir = path.posix.dirname(norm);
  const stem = path.posix.basename(norm, '.md');
  if (dir === '.' || dir === '') {
    return `krio-${stem}`;
  }
  return `${dir}/krio-${stem}`;
}

/** 由 Proposal 路径推导配对 Spec 路径 */
export function deriveSpecPathFromProposal(proposalRel: string): string {
  let rel = proposalRel.replace(/\\/g, '/');
  if (rel.startsWith('proposals/')) {
    rel = rel.slice('proposals/'.length);
  }
  const dir = path.posix.dirname(rel);
  const file = path.posix.basename(rel, '.md');
  let name = file.replace(/-?proposal$/i, 'spec').replace(/^proposal$/i, 'spec');
  if (name === file) {
    name = `${file}-spec`;
  }
  if (dir === '.' || dir === '') {
    return `specs/${name}.md`;
  }
  return `specs/${dir}/${name}.md`;
}

const REQUIREMENT_TEMPLATE = (specRel: string) => `# Requirement（需求摘录）

> 来源 Spec：\`${specRel}\`  
> 由 GlueKit 拆分生成；请与主 Spec 的「用户故事 / 需求」章节保持同步。

## 范围摘要

（从 Spec 复制或摘要）

## 关键验收点

- [ ] 与 Spec AC 对齐

`;

const DESIGN_TEMPLATE = (specRel: string) => `# Design（设计摘录）

> 来源 Spec：\`${specRel}\`

## 架构 / 数据流

## 接口与风险

`;

const TASKS_TEMPLATE = `# Tasks（可执行清单）

> **GlueKit 推荐**：在「拆分」页将每条 \`- [ ]\` 任务拆成子卡片，一键**填入对话**或 **Quest**（复制提示词 + @ 引用 Spec / tasks / design / requirement），由 Agent 执行；行尾 \`<!-- gk:run:... -->\` 仅可选用于「门禁与拆分」页的终端快捷，**非必须**。

- [ ] **T1** 阅读 Spec 与 requirement <!-- gk:run:echo Done reading -->
- [ ] **T2** 运行项目自检（请改为你的命令） <!-- gk:run:npm run build -->

`;

/** 生成 Kiro 风格 requirement / design / tasks */
export async function generateKrioSplit(specRel: string): Promise<string | undefined> {
  const state = await loadState();
  if (!(await canSplitSpec(state, specRel))) {
    return '需先通过 Spec v1.0 门禁，且将 Spec 冻结（status: frozen）后才能拆分。';
  }
  const r = root();
  if (!r) {
    return '未打开工作区';
  }
  const out = splitOutputDir(specRel);
  const req = `${out}/requirement.md`;
  const des = `${out}/design.md`;
  const tsk = `${out}/tasks.md`;
  const dirUri = vscode.Uri.joinPath(r, ...out.split('/'));
  await vscode.workspace.fs.createDirectory(dirUri);
  await writeWorkspaceFile(req, REQUIREMENT_TEMPLATE(specRel));
  await writeWorkspaceFile(des, DESIGN_TEMPLATE(specRel));
  await writeWorkspaceFile(tsk, TASKS_TEMPLATE);
  void vscode.window.showInformationMessage(`GlueKit：已生成 ${req}、design.md、tasks.md`);
  try {
    const doc = await vscode.workspace.openTextDocument(relUri(tsk)!);
    await vscode.window.showTextDocument(doc);
  } catch {
    /* ok */
  }
  return undefined;
}

/** 基于 Proposal 创建 Spec 草稿（需已通过 Proposal 门禁，或 Proposal 页四项自检全部勾选） */
export async function createSpecDraftFromProposal(proposalRel: string): Promise<string | undefined> {
  const state = await loadState();
  if (!isProposalGatePassed(state, proposalRel) && !proposalSelfChecksComplete(state, proposalRel)) {
    return '请先在 Proposal 页勾选「通过 Proposal 门禁」，或完成右侧四项人工自检并全选后再生成 Spec 草稿。';
  }
  const r = root();
  if (!r) {
    return '未打开工作区';
  }
  const specRel = deriveSpecPathFromProposal(proposalRel);

  const uri = relUri(specRel);
  if (!uri) {
    return '路径无效';
  }
  try {
    await vscode.workspace.fs.stat(uri);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    void vscode.window.showInformationMessage(`GlueKit：Spec 已存在，已打开 ${specRel}`);
    return undefined;
  } catch {
    /* create */
  }

  const body = `---
title: ""
status: draft
derived_from: ${proposalRel}
spec_version: "1.0-draft"
---

# 概述

> **从 Proposal 进入 Spec 阶段**：在 Cursor 中用 **@文件** 引用 \`${proposalRel}\`，让 AI 按本模板补全各节（实现前请通过 Spec v1.0 门禁后再冻结）。

# 术语与范围

（由 AI 根据 Proposal 归纳）

# 用户故事与场景

# 功能与非功能需求

# 方案设计

# 验收标准（AC）

- [ ] AC-1：
- [ ] AC-2：

# 风险与开放问题

`;

  const specParent = vscode.Uri.joinPath(r, ...path.posix.dirname(specRel).split('/').filter(Boolean));
  await vscode.workspace.fs.createDirectory(specParent);
  await writeWorkspaceFile(specRel, body);
  void vscode.window.showInformationMessage(`GlueKit：已创建 ${specRel}`);
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  } catch {
    /* ok */
  }
  return undefined;
}

/** 解析 tasks.md 中的 gk:run 指令 */
export function parseTasksRunCommands(tasksMd: string): { label: string; cmd: string }[] {
  const out: { label: string; cmd: string }[] = [];
  const lines = tasksMd.split(/\r?\n/);
  for (const line of lines) {
    const run = line.match(/<!--\s*gk:run:([^>]+)\s*-->/);
    if (!run) {
      continue;
    }
    const cmd = run[1].trim();
    const m = line.match(/\*\*([^*]+)\*\*/);
    const label = m ? m[1].trim() : cmd.slice(0, 40);
    out.push({ label, cmd });
  }
  return out;
}

export async function runTaskCommand(cmd: string): Promise<void> {
  const pick = await vscode.window.showWarningMessage(`在终端执行？\n${cmd}`, { modal: true }, '执行', '取消');
  if (pick !== '执行') {
    return;
  }
  const term = vscode.window.createTerminal({ name: 'GlueKit Task' });
  term.show();
  term.sendText(cmd, true);
}

export async function getRunnableTasksForSpec(specRel: string): Promise<{ label: string; cmd: string }[]> {
  const dir = splitOutputDir(specRel);
  const tasksPath = `${dir}/tasks.md`;
  const t = await readWorkspaceFile(tasksPath);
  if (!t) {
    return [];
  }
  return parseTasksRunCommands(t);
}
