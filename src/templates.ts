import * as vscode from 'vscode';

async function openDocument(uri: vscode.Uri): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: false });
}

const PROPOSAL_TEMPLATE = `---
title: ""
status: draft
author: ""
reviewers: []
related_specs: []
tags: []
---

# 背景与问题陈述

## 业务背景

（当前业务/用户场景、痛点、数据或合规约束。）

## 待解决问题

1. 
2. 

# 目标与成功标准

## 目标（Goals）

- 

## 非目标（Non-Goals）

- 明确写出**不做什么**，避免范围蔓延。

## 成功标准（可度量）

| 指标 | 当前 | 目标 | 采集方式 |
|------|------|------|----------|
| 例如：响应时延 P95 |  |  |  |

# 范围

## In Scope

- 

## Out of Scope

- 

# 相关方与角色

| 角色 | 职责 |
|------|------|
| 产品/业务 |  |
| 研发 |  |
| 安全/合规 |  |

# 约束与假设

- **技术约束**：（语言、云平台、遗留系统）
- **时间/人力**：
- **假设**：（若不成立需回滚或重开 Proposal）

# 风险与依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
|  |  |  |

**外部依赖**：（第三方 API、其他团队、许可证）

# 里程碑建议

- [ ] Proposal 评审通过
- [ ] Spec 定稿并绑定验收标准（AC）
- [ ] 实现与联调
- [ ] 上线与回顾

# 门禁清单（Proposal 阶段）

- [ ] 目标与非目标已与相关方对齐
- [ ] 成功标准可度量或可追溯
- [ ] 主要风险已记录并有负责人
`;

const SPEC_TEMPLATE = `---
title: ""
status: draft
# 规约配套：在下行起多行列表，路径相对仓库根（「规约配套」Tab 会汇总）
# 示例（删除 # 后使用）：
# gluekit_material:
#   - docs/contracts/openapi.yaml
#   - docs/deployment/README.md
gluekit_material: []
parent_proposal: ""
owners: []
---

# 概述

## 文档目的

（本 Spec 解决什么问题，与哪份 Proposal 对应。）

## 术语

| 术语 | 含义 |
|------|------|
|  |  |

# 用户故事与场景

## 用户故事

- 作为 **{角色}**，我希望 **{能力}**，以便 **{价值}**。

## 典型场景

1. **主路径**：
2. **异常路径**：
3. **边界条件**：

# 需求说明

## 功能需求

| ID | 描述 | 优先级 |
|----|------|--------|
| FR-1 |  | P0 |

## 非功能需求

- **性能**：
- **可用性**：
- **安全**：（鉴权、敏感数据、审计）
- **可观测性**：（日志、指标、追踪）

# 方案设计

## 架构 / 数据流

（文字描述或引用 design/ 下文档。）

## 接口与契约

### API / 事件

| 名称 | 类型 | 说明 |
|------|------|------|
|  | REST / MQ / … |  |

### 数据模型

（关键实体、字段、状态机。）

## 错误与降级

| 场景 | 行为 | 用户可见 |
|------|------|----------|
|  |  |  |

# 验收标准（AC）

> 每条 AC 应可独立验证；建议与测试用例或检查脚本 ID 对应。

- [ ] **AC-1**：（Given / When / Then 或明确期望）
- [ ] **AC-2**：
- [ ] **AC-3**：

# 拆分与追踪（可选）

- **tasks/**：（任务文档相对链接）
- **design/**：（设计补充相对链接）

# 风险与开放问题

- 

# 修订记录

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| 0.1 |  |  | 初稿 |
`;

export async function createProposalTemplate(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage('GlueKit：请先打开工作区文件夹。');
    return;
  }
  const dir = vscode.Uri.joinPath(folder.uri, 'proposals');
  await vscode.workspace.fs.createDirectory(dir);
  const file = vscode.Uri.joinPath(dir, 'gluekit-proposal.md');

  try {
    await vscode.workspace.fs.stat(file);
    const pick = await vscode.window.showWarningMessage('gluekit-proposal.md 已存在。', '打开现有', '取消');
    if (pick === '打开现有') {
      await openDocument(file);
    }
    return;
  } catch {
    /* create */
  }

  await vscode.workspace.fs.writeFile(file, Buffer.from(PROPOSAL_TEMPLATE, 'utf8'));
  await openDocument(file);
  void vscode.window.showInformationMessage('GlueKit：已创建 proposals/gluekit-proposal.md（详细模板）');
}

export async function createSpecTemplate(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage('GlueKit：请先打开工作区文件夹。');
    return;
  }
  const dir = vscode.Uri.joinPath(folder.uri, 'specs');
  await vscode.workspace.fs.createDirectory(dir);
  const file = vscode.Uri.joinPath(dir, 'gluekit-spec.md');

  try {
    await vscode.workspace.fs.stat(file);
    const pick = await vscode.window.showWarningMessage('gluekit-spec.md 已存在。', '打开现有', '取消');
    if (pick === '打开现有') {
      await openDocument(file);
    }
    return;
  } catch {
    /* create */
  }

  await vscode.workspace.fs.writeFile(file, Buffer.from(SPEC_TEMPLATE, 'utf8'));
  await openDocument(file);
  void vscode.window.showInformationMessage('GlueKit：已创建 specs/gluekit-spec.md（详细模板）');
}
