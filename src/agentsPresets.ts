import * as vscode from 'vscode';
import { readWorkspaceFile, writeWorkspaceFile } from './workflow';

async function mkdirpParentsForFile(rel: string): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root || rel.includes('..')) {
    return;
  }
  const segments = rel.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return;
  }
  let cur = root;
  for (let i = 0; i < segments.length - 1; i++) {
    cur = vscode.Uri.joinPath(cur, segments[i]);
    try {
      await vscode.workspace.fs.createDirectory(cur);
    } catch {
      /* 已存在 */
    }
  }
}

/** 初始化与「场景标签」共用的 AGENTS 基础正文（仍建议控制在约 100 行量级，细节进 docs） */
export const AGENTS_BASE_TEMPLATE = `# 导航地图（GlueKit / Harness）

> 只做**索引与指路**；详细设计、接口与流程放在 \`docs/\` 按需加载。

## 仓库速览

| 主题 | 路径 |
|------|------|
| 业务 / 产品上下文 | \`docs/PRODUCT_SENSE.md\` |
| 架构与分层 | \`docs/ARCHITECTURE.md\` |
| 构建、测试、lint | \`docs/DEVELOPMENT.md\` |
| 组件级设计 | \`docs/design-docs/\` |
| 执行计划 | \`docs/exec-plans/\` |

## Qoder 项目资源（索引）

若使用 Qoder，项目内常见路径如下（**仅指路**，细节在各文件中，勿把长文堆进本文件）：

| 类型 | 路径 | 说明 |
|------|------|------|
| 自定义 Agent | \`.qoder/agents/\` | 项目级 Agent 定义 |
| Skills | \`.qoder/skills/<name>/\` | 技能包，多为 \`SKILL.md\` |
| Rules | \`.qoder/rules/\` | 项目规则（生效策略在 Qoder 中配置） |
| 留痕日志（可选） | \`.qoder/logs/\` | 规则约定落盘或 GlueKit「剪贴板要点」追加 |

## 给 Agent 的工作方式

1. **先读地图再下钻**：从本文件找到章节，再打开对应 \`docs/\` 文档。
2. **执行计划**：重大变更在 \`docs/exec-plans/\` 留痕（目标、范围、回滚）。
3. **验证**：优先走 \`scripts/validate.py\`；端到端脚本放 \`scripts/verify/\`。
4. **状态与复盘**：任务与检查点 \`harness/tasks\`，轨迹 \`harness/trace\`，经验 \`harness/memory\`。

## 协作与安全

- **语言**：技术说明与代码注释默认中文；对外 API 名、协议字段保持项目既定语言。
- **引用代码**：用仓库内路径或符号，避免臆造不存在的模块。
- **秘密与隐私**：不将密钥、令牌、客户 PII 写入仓库；配置走环境变量或密钥管理。

## 场景补强（可选）

下方段落可由 GlueKit **Harness → 导航地图预览** 中的「场景标签」一键追加（同一标签不会重复插入）。

---

## 术语与缩写（按需补充）

| 术语 | 含义 |
|------|------|
| （例）AC | 验收标准 |
| （例）MR | 合并请求 |
`;

type PresetDef = { id: string; label: string; marker: string; body: string };

const PRESET_DEFS: PresetDef[] = [
  {
    id: 'research',
    label: '投研助手',
    marker: '<!-- gk-agents-preset:research -->',
    body: `## 场景：投研助手类应用

- **典型用户**：研究员、投资顾问、风控复核。
- **数据特点**：多源研报/公告/行情；时效强；需标注数据来源与日期。
- **Agent 注意**：数值与结论必须可追溯至引用片段；不确定处写「待核验」。
- **合规**：遵守适用监管与内控；不输出未公开重大信息或投资建议话术。
- **建议文档**：在 \`docs/PRODUCT_SENSE.md\` 补充数据源清单与刷新频率。`,
  },
  {
    id: 'ecommerce',
    label: '电商',
    marker: '<!-- gk-agents-preset:ecommerce -->',
    body: `## 场景：电商 / 零售

- **核心域**：商品、订单、支付、库存、物流、售后、营销投放。
- **一致性**：下单与支付、库存扣减、退款状态需可对照 PRD / 状态机文档。
- **Agent 注意**：价格、库存、优惠券规则以服务端与配置为准，禁止硬编码「示例价」进生产路径。
- **建议文档**：在 \`docs/design-docs/\` 为下单、支付回调、库存同步各留一页说明。`,
  },
  {
    id: 'education',
    label: '教育',
    marker: '<!-- gk-agents-preset:education -->',
    body: `## 场景：教育 / 学习产品

- **典型功能**：课程、课节、作业、考试、学习进度、班级/师生权限。
- **权限**：未成年人与个人信息保护按团队合规要求执行；角色（学生/教师/管理员）边界写清。
- **Agent 注意**：题目与解析需可审核；随机出题若涉及版权素材需注明来源。
- **建议文档**：在 \`docs/PRODUCT_SENSE.md\` 说明学段、课制与计费模式（若适用）。`,
  },
  {
    id: 'saas',
    label: '通用 SaaS',
    marker: '<!-- gk-agents-preset:saas -->',
    body: `## 场景：通用 B2B SaaS

- **多租户**：租户隔离（数据、配置、计费）；避免跨租户泄漏。
- **订阅与配额**：套餐、用量限制、功能开关以配置或计费服务为准。
- **Agent 注意**：新 API 默认考虑鉴权、租户上下文、审计日志钩子。
- **建议文档**：在 \`docs/ARCHITECTURE.md\` 标明租户上下文在请求链路中的传递方式。`,
  },
];

function findPreset(id: string): PresetDef | undefined {
  return PRESET_DEFS.find((p) => p.id === id);
}

/**
 * 若 AGENTS 不存在则先写入基础模板；再追加场景段落（按 marker 去重，不覆盖已有文件其他内容）。
 */
export async function appendAgentsScenario(
  folder: vscode.WorkspaceFolder,
  agentsRel: string,
  presetId: string
): Promise<{ ok: boolean; message: string }> {
  const preset = findPreset(presetId);
  if (!preset) {
    return { ok: false, message: `未知场景：${presetId}` };
  }
  if (agentsRel.includes('..')) {
    return { ok: false, message: '路径无效' };
  }

  let text = (await readWorkspaceFile(agentsRel))?.trimEnd() ?? '';
  if (!text) {
    text = AGENTS_BASE_TEMPLATE.trimEnd();
  }
  if (text.includes(preset.marker)) {
    return { ok: true, message: `「${preset.label}」段落已在 ${agentsRel} 中，未重复插入。` };
  }
  const block = `\n\n${preset.marker}\n${preset.body}\n`;
  const next = `${text}${block}`;
  await mkdirpParentsForFile(agentsRel);
  const ok = await writeWorkspaceFile(agentsRel, next);
  if (!ok) {
    return { ok: false, message: '写入 AGENTS.md 失败' };
  }
  return { ok: true, message: `已追加「${preset.label}」到 ${agentsRel}` };
}

export async function openAgentsInEditor(agentsRel: string): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root || agentsRel.includes('..')) {
    return;
  }
  const uri = vscode.Uri.joinPath(root, ...agentsRel.split('/').filter(Boolean));
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch {
    /* ignore */
  }
}
