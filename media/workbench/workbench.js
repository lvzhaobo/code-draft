(function () {
  const vscode = acquireVsCodeApi();

  const SPEC_NARRATIVE =
    'Spec 驱动：以「可验收规约」为枢纽——Proposal 提供输入；验收标准（AC）在 Spec 文档内设计与迭代；冻结后生成 krio-* 任务/设计文件，在 Tasks Tab 落地跟踪；门禁对齐质量，Glue 提供上下文，Harness 收敛工程化结果。';

  const STEPS = [
    {
      area: 'prop',
      specRole: '输入：业务动机与边界，为 Spec 提供共识基础。',
      concept: 'Proposal（提案）',
      title: '第 1 步：说清楚要做什么',
      hint: '先写清背景、目标、范围，避免后面 Spec 空转。',
      explain: 'Proposal 对应「为什么要做、做到哪算完」。不必一次完美，但要可讨论。',
      checklist: [
        { id: 's0-a', text: '已创建或找到 Proposal 文档' },
        { id: 's0-b', text: 'frontmatter（标题/状态等）已填写' },
        { id: 's0-c', text: '「范围 / 非目标」已写初稿' },
      ],
    },
    {
      area: 'spec',
      specRole: '核心：AC 与方案是实现的单一真相来源（与 OpenSpec/SpecKit 分工协作）。',
      concept: 'Spec（规约）',
      title: '第 2 步：写成可验收的说明',
      hint: '验收标准（AC）写在本文档的专门章节，作为「可测的完成定义」；实现与测试都应对照 AC。',
      explain:
        'Spec Coding：用结构化文档约束需求与设计，而不是只写在聊天里。AC 在第 2 步 Spec 正文里撰写与评审，不是冻结后才另起文档；本步门禁是对 AC 与方案做一次「可对齐、可测」的确认。',
      checklist: [
        { id: 's1-a', text: '已有 Spec 文档（含概述与方案）' },
        { id: 's1-b', text: '验收标准（AC）章节非空' },
        { id: 's1-c', text: '已考虑 gluekit_material / 物料绑定（若团队要求）' },
      ],
    },
    {
      area: 'split',
      specRole: '落地：把 Spec 拆成可执行单元，保持与 AC 可追溯。',
      concept: 'Tasks（拆分产物）',
      title: '第 3 步：拆成能干活的小块',
      hint: '大 Spec 拆成任务与设计说明，便于分工与跟踪。',
      explain: '冻结 Spec 后生成 krio-* 下的 requirement/design/tasks；日常在 Tasks Tab 查看清单与子任务卡片。',
      checklist: [
        { id: 's2-a', text: '已创建 tasks/ 或 design/ 下文档（若本仓库启用拆分）' },
        { id: 's2-b', text: '任务描述粒度适合单人/单 MR 完成' },
      ],
    },
    {
      area: 'gate',
      specRole: '对齐：人工/自动化核对 Spec 与产物一致，为合并与发布设闸。',
      concept: '门禁 / AC',
      title: '第 4 步：能对上检查项',
      hint: '用清单保证「该写的都写了」，后续可接自动化 doctor。',
      explain: '本版仅本地勾选；与 CI 真门禁配合在 Harness 步骤查看链接。',
      checklist: [
        { id: 's3-a', text: 'Proposal 门禁项已自检' },
        { id: 's3-b', text: 'Spec 与 AC 已对照过一遍' },
        { id: 's3-c', text: 'Tasks 产物与 Spec 无脱节（人工确认）' },
      ],
    },
    {
      area: 'glue',
      specRole: '上下文：实现与评审时「按团队范式」生成与修改代码的参照。',
      concept: 'Glue（可抄物料）',
      title: '第 5 步：备好可抄的上下文',
      hint: 'AGENTS.md、reference 等帮助 AI/同事按团队习惯写代码。',
      explain: 'Glue Coding：把范式、样例、约束写成「可复制的物料」，减少口头传递。',
      checklist: [
        { id: 's4-a', text: '已有 AGENTS.md 或 reference 说明（二选一或按规范）' },
        { id: 's4-b', text: '关键约定（目录、命令、禁改区）有处可查' },
      ],
    },
    {
      area: 'har',
      specRole: '闭环：流水线执行门禁与指标，IDE 侧看见状态与入口。',
      concept: 'Harness（工程化）',
      title: '第 6 步：看见流水线与门禁',
      hint: '本地 green 不够时，要知道线上去哪看结果。',
      explain: 'Harness Engineering：CI、策略、指标仍在流水线执行，IDE 侧聚合链接与状态占位。',
      checklist: [
        { id: 's5-a', text: '已配置 CI 或流水线文档（仓库内或外链）' },
        { id: 's5-b', text: '知道最近一次流水线入口（URL 或平台）' },
      ],
    },
  ];

  /** 0.5：两主轴 — 「流程」= 步骤引导 + 门禁/Tasks 操作；「地图」= 扫描统计与快捷跳转；文档三页 + 物料/工程化 + 示例 + Qoder */
  const TABS = [
    { id: 'flow', label: '流程' },
    { id: 'map', label: '地图' },
    { id: 'proposal', label: 'Proposal' },
    { id: 'spec', label: 'Spec' },
    { id: 'materials', label: '规约配套' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'glue', label: 'Glue' },
    { id: 'harness', label: 'Harness' },
    { id: 'examples', label: '示例与脚手架' },
    { id: 'qoder', label: '.qoder' },
  ];

  let scan = emptyScan();
  let state = defaultState();
  let activeTab = 'flow';
  let errMsg = '';
  /** @type {{ spec: string; tasks: { label: string; cmd: string }[] } | null} */
  let workflowRunnable = null;

  /** @type {{ path: string; text: string; truncated: boolean; error: string; loading: boolean }} */
  let filePreview = { path: '', text: '', truncated: false, error: '', loading: false };

  /** 流程页「文内预览」专用，避免与 Harness 的 AGENTS 预览互相覆盖 */
  let workflowFilePreview = { path: '', text: '', truncated: false, error: '', loading: false };

  /** .qoder 资源 Tab 专用预览（与 AGENTS 预览分流） */
  let qoderFilePreview = { path: '', text: '', truncated: false, error: '', loading: false };

  /** 与 data-link-path 联动：Proposal 卡片 ↔ 流程/文档页 ↔ Harness 参考行 */
  let linkedFocusPath = '';

  function emptyScan() {
    return {
      proposals: [],
      specs: [],
      tasks: [],
      design: [],
      agents: [],
      references: [],
      ciHints: [],
      customTemplates: { proposals: [], specs: [] },
      examples: [],
      exampleManifest: {},
      specFrozen: {},
      extensionVersion: '',
      harnessGuide: [],
      specDerivedFrom: {},
      specGluekitMaterial: {},
      contractFiles: [],
      deploymentDocs: [],
      traceabilityDocs: [],
      changelogFiles: [],
      specSplitBundles: [],
      qoderFiles: [],
    };
  }

  function customTemplatesFor(kind) {
    const ct = scan.customTemplates;
    if (!ct) {
      return [];
    }
    return kind === 'proposal' ? ct.proposals || [] : ct.specs || [];
  }

  function bindCustomTemplateClicks(root) {
    if (!root) {
      return;
    }
    root.querySelectorAll('[data-custom-src]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({
          type: 'createFromCustomTemplate',
          payload: {
            kind: btn.getAttribute('data-custom-kind'),
            source: btn.getAttribute('data-custom-src'),
          },
        });
      });
    });
  }

  function defaultState() {
    return {
      version: 1,
      currentStep: 0,
      skippedSteps: [],
      checklist: {},
      harnessLinks: [],
      proposalGate: {},
      specGate: {},
      frozenSpecs: [],
      proposalSelfChecks: {},
    };
  }

  function proposalGateOk(p) {
    const g = state.proposalGate && state.proposalGate[p];
    return !!(g && g.passed);
  }

  const PROPOSAL_SELF_IDS = ['prop-a', 'prop-b', 'prop-c', 'prop-d'];
  const PROPOSAL_SELF_ITEMS = [
    { id: 'prop-a', text: '已阅读 Proposal：背景、目标、范围清楚' },
    { id: 'prop-b', text: 'frontmatter（标题 / 状态等）已填写' },
    { id: 'prop-c', text: '「范围 / 非目标」已有初稿' },
    { id: 'prop-d', text: '主要争议点已与评审方或 AI 对齐' },
  ];

  function proposalSelfChecksAllOk(p) {
    const row = (state.proposalSelfChecks && state.proposalSelfChecks[p]) || {};
    return PROPOSAL_SELF_IDS.every((id) => row[id] === true);
  }

  function applyLinkedFocus() {
    const p = linkedFocusPath;
    document.querySelectorAll('[data-link-path]').forEach((el) => {
      el.classList.toggle('gk-linked-focus', !!p && el.getAttribute('data-link-path') === p);
    });
  }

  function setLinkedFocusPath(path, opts) {
    linkedFocusPath = path || '';
    applyLinkedFocus();
    if (opts && opts.reveal && linkedFocusPath) {
      vscode.postMessage({ type: 'revealInExplorer', payload: linkedFocusPath });
    }
  }

  function specGateOk(p) {
    const g = state.specGate && state.specGate[p];
    return !!(g && g.passed);
  }

  function specFileFrozen(p) {
    return !!(scan.specFrozen && scan.specFrozen[p]);
  }

  function isSkipped(i) {
    return (state.skippedSteps || []).includes(i);
  }

  function stepAutoOk(i) {
    switch (i) {
      case 0:
        return scan.proposals.length > 0;
      case 1:
        return scan.specs.length > 0;
      case 2:
        return scan.tasks.length + scan.design.length > 0;
      case 3:
        return gateManualOk();
      case 4:
        return scan.agents.length + scan.references.length > 0;
      case 5:
        return (state.harnessLinks || []).some((u) => String(u).trim().length > 0) || scan.ciHints.length > 0;
      default:
        return false;
    }
  }

  function score() {
    let done = 0;
    let total = 0;
    for (let i = 0; i < STEPS.length; i++) {
      if (isSkipped(i)) {
        continue;
      }
      total++;
      const auto = stepAutoOk(i);
      const manual = i === 3 ? gateManualOk() : true;
      if (auto && manual) {
        done++;
      }
    }
    if (total === 0) {
      return { pct: 100, done: 0, total: 0 };
    }
    return { pct: Math.round((done / total) * 100), done, total };
  }

  function gateManualOk() {
    const ids = ['s3-a', 's3-b', 's3-c'];
    return ids.every((id) => state.checklist[id]);
  }

  function persist() {
    vscode.postMessage({ type: 'saveState', payload: state });
  }

  let persistTimer;
  function persistDebounced() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 200);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function badgeClass(pct) {
    if (pct >= 80) {
      return 'ok';
    }
    if (pct >= 40) {
      return 'warn';
    }
    return 'bad';
  }

  function render() {
    const root = document.getElementById('root');
    if (!root) {
      return;
    }
    const sc = score();
    const badge = badgeClass(sc.pct);
    const ver = scan.extensionVersion ? esc(scan.extensionVersion) : '…';

    root.innerHTML = `
      <header class="gk-header">
        <div>
          <div class="gk-title-row">
            <span class="gk-title">GlueKit 工作台</span>
            <span class="gk-ver-pill" title="与「扩展」面板中本扩展版本一致；若长期为 0.2.0，请卸载后重装最新 .vsix">v${ver}</span>
          </div>
          <div class="gk-note">IDE 内工具面板 · Spec 驱动画布（侧栏式步骤与资源编排）</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="gk-badge ${badge}" title="已启用步骤的粗略完整度">完整度 ${sc.total ? sc.pct + '%' : '—'}</span>
          <div class="gk-actions">
            <button type="button" class="ghost" id="btn-refresh">刷新扫描</button>
          </div>
        </div>
      </header>
      ${errMsg ? `<div class="gk-error">${esc(errMsg)}</div>` : ''}
      <nav class="gk-tabs" role="tablist">
        ${TABS.map(
          (t) =>
            `<button type="button" class="gk-tab ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">${esc(
              t.label
            )}</button>`
        ).join('')}
      </nav>
      <section class="gk-panel ${activeTab === 'flow' ? 'active' : ''}" data-panel="flow"></section>
      <section class="gk-panel ${activeTab === 'map' ? 'active' : ''}" data-panel="map"></section>
      <section class="gk-panel ${activeTab === 'examples' ? 'active' : ''}" data-panel="examples"></section>
      <section class="gk-panel ${activeTab === 'proposal' ? 'active' : ''}" data-panel="proposal"></section>
      <section class="gk-panel ${activeTab === 'spec' ? 'active' : ''}" data-panel="spec"></section>
      <section class="gk-panel ${activeTab === 'materials' ? 'active' : ''}" data-panel="materials"></section>
      <section class="gk-panel ${activeTab === 'tasks' ? 'active' : ''}" data-panel="tasks"></section>
      <section class="gk-panel ${activeTab === 'glue' ? 'active' : ''}" data-panel="glue"></section>
      <section class="gk-panel ${activeTab === 'harness' ? 'active' : ''}" data-panel="harness"></section>
      <section class="gk-panel ${activeTab === 'qoder' ? 'active' : ''}" data-panel="qoder"></section>
      <footer class="gk-version-footer">GlueKit Workbench <strong>v${ver}</strong></footer>
    `;

    document.querySelectorAll('.gk-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        errMsg = '';
        render();
      });
    });

    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      errMsg = '';
      vscode.postMessage({ type: 'requestScan' });
    });

    renderFlowPanel();
    renderMapPanel();
    renderExamples();
    renderProposalPanel();
    renderSpecPanel();
    renderMaterialsPanel();
    renderSplitCanvas();
    renderGlue();
    renderHarness();
    renderQoderPanel();
    applyLinkedFocus();
  }

  function tabForStep(i) {
    return ['proposal', 'spec', 'tasks', 'flow', 'glue', 'harness'][i] || 'map';
  }

  function filesForStep(i) {
    switch (i) {
      case 0:
        return scan.proposals;
      case 1:
        return scan.specs;
      case 2:
        return [...scan.tasks, ...scan.design];
      case 3:
        return [];
      case 4:
        return [...scan.agents, ...scan.references];
      case 5:
        return scan.ciHints;
      default:
        return [];
    }
  }

  function renderFileChips(files, max, stepIndex) {
    if (stepIndex === 3) {
      return '';
    }
    const tab = tabForStep(stepIndex);
    const show = files.slice(0, max);
    let html = show
      .map((f) => {
        const base = f.split('/').pop() || f;
        return `<button type="button" class="gk-chip" data-open="${esc(f)}">${esc(base)}</button>`;
      })
      .join('');
    if (files.length > max) {
      html += `<button type="button" class="gk-chip gk-chip-more" data-jump-tab="${esc(tab)}">+${files.length - max} …</button>`;
    }
    if (stepIndex === 5) {
      const n = (state.harnessLinks || []).filter((u) => String(u).trim()).length;
      if (n > 0) {
        html += `<span class="gk-chip gk-chip-static">${n} 外链</span>`;
      }
    }
    if (!html) {
      return '<span class="gk-card-empty">暂无文件</span>';
    }
    return html;
  }

  function renderMiniChecklist(items) {
    return `<ul class="gk-card-check">${items
      .map((c) => {
        const checked = !!state.checklist[c.id];
        return `<li><input type="checkbox" data-check="${esc(c.id)}" id="cv-${esc(c.id)}" ${checked ? 'checked' : ''} /><label for="cv-${esc(c.id)}">${esc(c.text)}</label></li>`;
      })
      .join('')}</ul>`;
  }

  function renderGateMini() {
    const ids = ['s3-a', 's3-b', 's3-c'];
    const labels = {
      's3-a': 'Proposal 门禁',
      's3-b': 'Spec↔AC',
      's3-c': 'Tasks 与 Spec 一致',
    };
    return `<ul class="gk-card-check gk-card-check--gate">${ids
      .map((id) => {
        const checked = !!state.checklist[id];
        return `<li><input type="checkbox" data-check="${esc(id)}" id="cg-${esc(id)}" ${checked ? 'checked' : ''} /><label for="cg-${esc(id)}">${esc(labels[id])}</label></li>`;
      })
      .join('')}</ul>`;
  }

  function renderCardFooter(i) {
    if (i === 0) {
      let h = `<button type="button" class="primary sm" data-create="proposal">内置 Proposal</button>`;
      customTemplatesFor('proposal').slice(0, 2).forEach((t) => {
        h += `<button type="button" class="ghost sm gk-tpl" data-custom-kind="proposal" data-custom-src="${esc(t.source)}">${esc(t.label)}</button>`;
      });
      return h;
    }
    if (i === 1) {
      let h = `<button type="button" class="primary sm" data-create="spec">内置 Spec</button>`;
      customTemplatesFor('spec').slice(0, 2).forEach((t) => {
        h += `<button type="button" class="ghost sm gk-tpl" data-custom-kind="spec" data-custom-src="${esc(t.source)}">${esc(t.label)}</button>`;
      });
      h += `<button type="button" class="ghost sm" data-jump-tab="materials">规约配套</button>`;
      return h;
    }
    if (i === 2) {
      return `<button type="button" class="ghost sm" data-jump-tab="tasks">Tasks 列表</button>`;
    }
    if (i === 4) {
      return `<button type="button" class="ghost sm" data-jump-tab="glue">物料列表</button>`;
    }
    if (i === 5) {
      return `<button type="button" class="ghost sm" data-jump-tab="harness">CI 外链</button>`;
    }
    return '';
  }

  function renderOneCard(i, cur) {
    const st = STEPS[i];
    const done = !isSkipped(i) && stepAutoOk(i);
    const skip = isSkipped(i);
    const current = i === cur;
    const files = filesForStep(i);
    const maxChips = st.area === 'spec' ? 6 : 4;
    const chips = renderFileChips(files, maxChips, i);
    const checklistBlock = i === 3 ? renderGateMini() : renderMiniChecklist(st.checklist);
    const foot = renderCardFooter(i);

    return `<article class="gk-card ${done ? 'gk-card--done' : ''} ${skip ? 'gk-card--skip' : ''} ${current ? 'gk-card--current' : ''} ${st.area === 'spec' ? 'gk-card--spec' : ''}" data-area="${esc(st.area)}" data-step-index="${i}">
      <header class="gk-card-head">
        <button type="button" class="gk-card-hit" data-go-step="${i}" title="展开下方详情">
          <span class="gk-card-num">${i + 1}</span>
          <div class="gk-card-titles">
            <span class="gk-card-name">${esc(st.concept.split('（')[0])}</span>
            <span class="gk-card-sub">${esc(st.title.replace(/^第 \d+ 步：/, ''))}</span>
          </div>
        </button>
        <span class="gk-card-dot ${done ? 'is-done' : ''} ${skip ? 'is-skip' : ''}" aria-hidden="true"></span>
      </header>
      <p class="gk-card-role">${esc(st.specRole)}</p>
      <div class="gk-card-chips">${chips}</div>
      ${checklistBlock}
      ${foot ? `<footer class="gk-card-ft">${foot}</footer>` : ''}
    </article>`;
  }

  function renderCustomTemplatePickers(stepIndex) {
    const p = customTemplatesFor('proposal');
    const s = customTemplatesFor('spec');
    if (stepIndex === 0) {
      if (!p.length) {
        return '<p class="gk-note">自定义 Proposal：<code>.gluekit/templates/proposal/*.md</code></p>';
      }
      if (p.length <= 2) {
        return '';
      }
      return `<p class="gk-note">更多 Proposal 模板：</p><div class="gk-file-list">${p
        .slice(2)
        .map(
          (t) =>
            `<button type="button" class="gk-file gk-tpl" data-custom-kind="proposal" data-custom-src="${esc(t.source)}">${esc(t.label)}</button>`
        )
        .join('')}</div>`;
    }
    if (stepIndex === 1) {
      if (!s.length) {
        return '<p class="gk-note">自定义 Spec：<code>.gluekit/templates/spec/*.md</code></p>';
      }
      if (s.length <= 2) {
        return '';
      }
      return `<p class="gk-note">更多 Spec 模板：</p><div class="gk-file-list">${s
        .slice(2)
        .map(
          (t) =>
            `<button type="button" class="gk-file gk-tpl" data-custom-kind="spec" data-custom-src="${esc(t.source)}">${esc(t.label)}</button>`
        )
        .join('')}</div>`;
    }
    return '';
  }

  function bindCanvasPanel(el) {
    el.querySelectorAll('[data-go-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.currentStep = parseInt(btn.getAttribute('data-go-step'), 10);
        persistDebounced();
        render();
      });
    });
    el.querySelectorAll('[data-check]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const id = inp.getAttribute('data-check');
        state.checklist[id] = inp.checked;
        persistDebounced();
        render();
      });
    });
    el.querySelectorAll('[data-create]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'createFromTemplate', payload: btn.getAttribute('data-create') });
      });
    });
    el.querySelectorAll('[data-jump-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-jump-tab');
        errMsg = '';
        render();
      });
    });
    el.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openFile', payload: btn.getAttribute('data-open') });
      });
    });
    el.querySelectorAll('[data-toggle-skip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-toggle-skip'), 10);
        const arr = state.skippedSteps || [];
        if (arr.includes(idx)) {
          state.skippedSteps = arr.filter((x) => x !== idx);
        } else {
          state.skippedSteps = [...new Set([...arr, idx])].sort((a, b) => a - b);
        }
        persistDebounced();
        render();
      });
    });
    bindCustomTemplateClicks(el);
  }

  function preferredAgentsPath() {
    const list = scan.agents || [];
    const hit = list.find((a) => /^AGENTS\.md$/i.test(a) || /\/AGENTS\.md$/i.test(a));
    return hit || list[0] || '';
  }

  function requestAgentsPreview(force) {
    const p = preferredAgentsPath();
    if (!p) {
      filePreview = { path: '', text: '', truncated: false, error: '', loading: false };
      return;
    }
    if (!force) {
      if (filePreview.path === p && (filePreview.text || filePreview.error)) {
        return;
      }
      if (filePreview.loading && filePreview.path === p) {
        return;
      }
    }
    filePreview = { path: p, text: '', truncated: false, error: '', loading: true };
    vscode.postMessage({ type: 'previewTextFile', payload: { path: p, maxLines: 52, maxChars: 5500 } });
  }

  function renderProposalPanel() {
    const el = document.querySelector('[data-panel="proposal"]');
    if (!el) {
      return;
    }
    const files = scan.proposals || [];
    const customs = customTemplatesFor('proposal');
    const customBlock =
      customs.length > 0
        ? `<p class="gk-hint" style="margin-top:10px;">自定义模板（<code>.gluekit/templates/proposal/</code>）</p><div class="gk-proposal-toolbar">${customs
            .map(
              (t) =>
                `<button type="button" class="ghost sm gk-tpl" data-custom-kind="proposal" data-custom-src="${esc(t.source)}">${esc(t.label)}</button>`
            )
            .join('')}</div>`
        : '';
    const cards =
      files.length > 0
        ? `<div class="gk-proposal-grid">${files
            .map((f) => {
              const base = f.split('/').pop() || f;
              const gate = proposalGateOk(f);
              const selfOk = proposalSelfChecksAllOk(f);
              const canGenSpec = gate || selfOk;
              const checks = (state.proposalSelfChecks && state.proposalSelfChecks[f]) || {};
              const checkLis = PROPOSAL_SELF_ITEMS.map(
                (it) =>
                  `<li class="gk-prop-check-li"><label class="gk-prop-check-label"><input type="checkbox" data-prop-self="${esc(
                    f
                  )}" data-prop-id="${esc(it.id)}" ${checks[it.id] ? 'checked' : ''} />${esc(it.text)}</label></li>`
              ).join('');
              return `<article class="gk-proposal-card" data-link-path="${esc(f)}">
            <div class="gk-proposal-card-split">
              <div class="gk-proposal-card-main" data-open-proposal="${esc(f)}" role="button" tabindex="0" title="打开文件">
                <div class="gk-proposal-card-head">
                  <span class="gk-proposal-card-title">${esc(base)}</span>
                  <span class="gk-badge ${gate ? 'ok' : 'warn'}">${gate ? '门禁已过' : '待过门禁'}</span>
                </div>
                <p class="gk-proposal-card-path"><code>${esc(f)}</code></p>
                <p class="gk-proposal-card-hint">流程<strong>上游</strong>：立项与共识输入（背景、目标、范围、风险、门禁前的「要不要做、做到哪」）。与冻结 Spec 之后的<strong>拆分三文件</strong>不是同一物。</p>
                <div class="gk-proposal-card-actions">
                  <button type="button" class="primary sm" data-open="${esc(f)}">打开</button>
                  <button type="button" class="ghost sm" data-jump-wf="${esc(f)}">完整流程</button>
                </div>
              </div>
              <aside class="gk-proposal-gate" aria-label="Proposal 门禁">
                <div class="gk-prop-gate-title">门禁条件（人工勾选）</div>
                <ul class="gk-prop-checklist">${checkLis}</ul>
                <div class="gk-prop-gate-actions">
                  <button type="button" class="ghost sm" data-copy-ai="${esc(f)}">复制 AI 提示词</button>
                  <button type="button" class="primary sm" data-prop-pass-card="${esc(f)}" ${gate ? 'disabled' : ''}>通过 Proposal 门禁</button>
                  <button type="button" class="ghost sm" data-prop-revoke-card="${esc(f)}" ${gate ? '' : 'disabled'}>撤销门禁</button>
                  <button type="button" class="primary sm" data-spec-draft="${esc(f)}" ${
                    canGenSpec ? '' : 'disabled'
                  } title="需通过门禁或左侧四项全勾">生成 Spec 草稿</button>
                </div>
                <p class="gk-note">「复制 AI 提示词」会写入剪贴板，请粘贴到 Cursor Chat。生成草稿需<strong>已通过门禁</strong>或<strong>四项自检全勾</strong>。Spec 定稿请在「流程」页下半区过 Spec 门禁并<strong>冻结</strong>。</p>
              </aside>
            </div>
          </article>`;
            })
            .join('')}</div>`
        : `<div class="gk-proposal-empty">
        <p class="gk-empty">当前工作区未发现 Proposal 文件（<code>proposals/**/*.md</code> 或 <code>*proposal*.md</code>）。</p>
        <p class="gk-note">先落一份上游提案，再进 Spec；画布排布与「Spec 流程画布」一致。</p>
      </div>`;

    el.innerHTML = `
      <div class="gk-proposal-banner">
        <p class="gk-spec-banner-label">Proposal · Canvas</p>
        <p class="gk-hint" style="margin:0;"><strong>Proposal 单独成块</strong>（流程上游）：立项与共识输入——背景、目标、范围、风险，以及门禁前的「要不要做、做到哪」。<strong>不是</strong>冻结 Spec 之后拆分目录里的那份 <code>requirement.md</code>（那是从规约向下游落地的摘录）。左侧文档、右侧自检与 AI 提示词；与「流程」页及 Spec <strong>同一 Proposal 路径</strong>联动高亮。</p>
      </div>
      <div class="gk-proposal-toolbar">
        <button type="button" class="primary" data-create="proposal">内置 Proposal 模板</button>
      </div>
      ${customBlock}
      <div class="gk-proposal-surface">${cards}</div>
    `;

    el.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-open');
        if (path) {
          setLinkedFocusPath(path);
        }
        vscode.postMessage({ type: 'openFile', payload: path });
      });
    });
    el.querySelectorAll('[data-create]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'createFromTemplate', payload: btn.getAttribute('data-create') });
      });
    });
    el.querySelectorAll('[data-jump-wf]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-jump-wf');
        if (p) {
          setLinkedFocusPath(p);
        }
        activeTab = 'flow';
        errMsg = '';
        render();
      });
    });
    el.querySelectorAll('.gk-proposal-gate').forEach((aside) => {
      aside.addEventListener('click', () => {
        const art = aside.closest('.gk-proposal-card');
        const p = art && art.getAttribute('data-link-path');
        if (p) {
          setLinkedFocusPath(p);
        }
      });
    });
    el.querySelectorAll('[data-open-proposal]').forEach((block) => {
      const open = () => {
        const path = block.getAttribute('data-open-proposal');
        if (path) {
          setLinkedFocusPath(path);
          vscode.postMessage({ type: 'openFile', payload: path });
        }
      };
      block.addEventListener('click', (ev) => {
        if (ev.target.closest('button')) {
          return;
        }
        open();
      });
      block.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          open();
        }
      });
    });
    el.querySelectorAll('[data-prop-self]').forEach((inp) => {
      inp.addEventListener('change', () => {
        vscode.postMessage({
          type: 'setProposalSelfCheck',
          payload: {
            path: inp.getAttribute('data-prop-self'),
            id: inp.getAttribute('data-prop-id'),
            checked: inp.checked,
          },
        });
      });
    });
    el.querySelectorAll('[data-copy-ai]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({ type: 'copyProposalAiPrompt', payload: btn.getAttribute('data-copy-ai') });
      });
    });
    el.querySelectorAll('[data-prop-pass-card]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({
          type: 'proposalGateSet',
          payload: { path: btn.getAttribute('data-prop-pass-card'), passed: true },
        });
      });
    });
    el.querySelectorAll('[data-prop-revoke-card]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({
          type: 'proposalGateSet',
          payload: { path: btn.getAttribute('data-prop-revoke-card'), passed: false },
        });
      });
    });
    el.querySelectorAll('[data-spec-draft]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({ type: 'createSpecFromProposal', payload: btn.getAttribute('data-spec-draft') });
      });
    });
    bindCustomTemplateClicks(el);
  }

  /** 与宿主 workflow.splitOutputDir 一致（POSIX 路径） */
  function splitKrioDirForSpec(specPath) {
    const norm = specPath.replace(/\\/g, '/');
    const idx = norm.lastIndexOf('/');
    const dir = idx < 0 ? '' : norm.slice(0, idx);
    const base = idx < 0 ? norm : norm.slice(idx + 1);
    const stem = base.replace(/\.md$/i, '');
    if (!dir) {
      return `krio-${stem}`;
    }
    return `${dir}/krio-${stem}`;
  }

  function renderSpecPanel() {
    const el = document.querySelector('[data-panel="spec"]');
    if (!el) {
      return;
    }
    const files = scan.specs || [];
    const derived = scan.specDerivedFrom || {};
    const customs = customTemplatesFor('spec');
    const customBlock =
      customs.length > 0
        ? `<p class="gk-hint" style="margin-top:10px;">自定义模板（<code>.gluekit/templates/spec/</code>）</p><div class="gk-spec-toolbar">${customs
            .map(
              (t) =>
                `<button type="button" class="ghost sm gk-tpl" data-custom-kind="spec" data-custom-src="${esc(t.source)}">${esc(t.label)}</button>`
            )
            .join('')}</div>`
        : '';
    if (!files.length) {
      el.innerHTML = `
        <div class="gk-spec-page-banner">
          <p class="gk-spec-banner-label">Spec · Canvas</p>
          <p class="gk-hint" style="margin:0;"><strong>Spec</strong> 是可验收规约：用户故事、功能/非功能需求、方案、<strong>AC</strong>；frontmatter 用 <code>derived_from</code> 指回上游 Proposal。冻结后可生成与 Spec 同级的 <code>krio-*</code> 拆分目录（需求 / 设计 / 任务三文件）。</p>
        </div>
        <div class="gk-spec-toolbar">
          <button type="button" class="primary" data-create="spec">内置 Spec 模板</button>
        </div>
        ${customBlock}
        <div class="gk-spec-surface"><p class="gk-empty">未发现 Spec 文件。可先写 Proposal 并「生成 Spec 草稿」。</p></div>
      `;
      el.querySelectorAll('[data-create]').forEach((btn) => {
        btn.addEventListener('click', () => {
          vscode.postMessage({ type: 'createFromTemplate', payload: btn.getAttribute('data-create') });
        });
      });
      bindCustomTemplateClicks(el);
      return;
    }
    const cards = files
      .map((s) => {
        const base = s.split('/').pop() || s;
        const df = derived[s];
        const sg = specGateOk(s);
        const fr = specFileFrozen(s);
        const kdir = splitKrioDirForSpec(s);
        const bundle = (scan.specSplitBundles || []).find((b) => b.specPath === s);
        const kcount = bundle ? bundle.krioRelPaths.length : 0;
        const dfChip = df
          ? `<button type="button" class="ghost sm gk-spec-chip" data-jump-prop="${esc(df)}">上游：${esc(df.split('/').pop() || df)}</button>`
          : '<span class="gk-note">未解析到 derived_from</span>';
        return `<article class="gk-spec-card" data-link-path="${esc(s)}">
          <div class="gk-spec-card-split">
            <div class="gk-spec-card-main" data-open-spec="${esc(s)}" role="button" tabindex="0" title="打开 Spec">
              <div class="gk-spec-card-head">
                <span class="gk-spec-card-title">${esc(base)}</span>
                <span class="gk-badge ${sg ? 'ok' : 'warn'}">${sg ? 'Spec 门禁已过' : '待过门禁'}</span>
                <span class="gk-badge ${fr ? 'ok' : 'bad'}">${fr ? '已冻结' : '草稿'}</span>
              </div>
              <p class="gk-spec-card-path"><code>${esc(s)}</code></p>
              <p class="gk-spec-card-hint">拆分目录：<code>${esc(kdir)}</code> · 已扫描到 <strong>${kcount}</strong> 个拆分相关文件</p>
              <div class="gk-spec-card-actions">
                <button type="button" class="primary sm" data-open="${esc(s)}">打开</button>
                <button type="button" class="ghost sm" data-jump-tasks="${esc(s)}">Tasks 页</button>
                <button type="button" class="ghost sm" data-jump-tab="materials">规约配套</button>
                <button type="button" class="ghost sm" data-jump-wf-spec>流程·操作</button>
              </div>
            </div>
            <aside class="gk-spec-aside" aria-label="关联">
              <div class="gk-spec-aside-title">串联</div>
              <div class="gk-spec-aside-row">${dfChip}</div>
              <p class="gk-note">冻结后可生成拆分三文件；任务行尾 <code>gk:run</code> 在流程页执行。</p>
            </aside>
          </div>
        </article>`;
      })
      .join('');
    el.innerHTML = `
      <div class="gk-spec-page-banner">
        <p class="gk-spec-banner-label">Spec · Canvas</p>
        <p class="gk-hint" style="margin:0;">每条卡片是一条<strong>可验收规约</strong>（用户故事、需求、方案、AC）；<code>derived_from</code> 连回 Proposal。契约/部署/CHANGELOG/追溯等见 <strong>规约配套</strong> Tab（扫描 + <code>gluekit_material</code>）。左侧打开编辑，右侧串联 Tasks 与流程操作。</p>
      </div>
      <div class="gk-spec-toolbar">
        <button type="button" class="primary" data-create="spec">内置 Spec 模板</button>
      </div>
      ${customBlock}
      <div class="gk-spec-surface"><div class="gk-spec-grid">${cards}</div></div>
    `;
    el.querySelectorAll('[data-create]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'createFromTemplate', payload: btn.getAttribute('data-create') });
      });
    });
    el.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-open');
        if (path) {
          setLinkedFocusPath(path);
        }
        vscode.postMessage({ type: 'openFile', payload: path });
      });
    });
    el.querySelectorAll('[data-open-spec]').forEach((block) => {
      const go = () => {
        const path = block.getAttribute('data-open-spec');
        if (path) {
          setLinkedFocusPath(path);
          vscode.postMessage({ type: 'openFile', payload: path });
        }
      };
      block.addEventListener('click', (ev) => {
        if (ev.target.closest('button')) {
          return;
        }
        go();
      });
      block.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          go();
        }
      });
    });
    el.querySelectorAll('[data-jump-prop]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const p = btn.getAttribute('data-jump-prop');
        if (p) {
          setLinkedFocusPath(p);
        }
        activeTab = 'proposal';
        errMsg = '';
        render();
      });
    });
    el.querySelectorAll('[data-jump-tasks]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const p = btn.getAttribute('data-jump-tasks');
        if (p) {
          setLinkedFocusPath(p);
        }
        activeTab = 'tasks';
        errMsg = '';
        render();
      });
    });
    el.querySelectorAll('[data-jump-tab]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const tab = btn.getAttribute('data-jump-tab');
        const card = btn.closest('.gk-spec-card');
        const p = card && card.getAttribute('data-link-path');
        if (p) {
          setLinkedFocusPath(p);
        }
        if (tab) {
          activeTab = tab;
          errMsg = '';
          render();
        }
      });
    });
    el.querySelectorAll('[data-jump-wf-spec]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const card = btn.closest('.gk-spec-card');
        const p = card && card.getAttribute('data-link-path');
        if (p) {
          setLinkedFocusPath(p);
        }
        activeTab = 'flow';
        errMsg = '';
        render();
      });
    });
    el.querySelectorAll('.gk-spec-aside').forEach((aside) => {
      aside.addEventListener('click', (ev) => {
        if (ev.target.closest('button')) {
          return;
        }
        const card = aside.closest('.gk-spec-card');
        const p = card && card.getAttribute('data-link-path');
        if (p) {
          setLinkedFocusPath(p);
        }
      });
    });
    bindCustomTemplateClicks(el);
  }

  function collectOrphanSplitFiles() {
    const bundles = scan.specSplitBundles || [];
    const assigned = new Set();
    bundles.forEach((b) => b.krioRelPaths.forEach((f) => assigned.add(f)));
    const tasks = (scan.tasks || []).filter((f) => !assigned.has(f));
    const design = (scan.design || []).filter((f) => !assigned.has(f));
    return { tasks, design };
  }

  /** 拆分目录下单个文件的展示角色（与 GlueKit 生成文件名一致） */
  function splitOutputFileRole(relPath) {
    const base = (relPath.split('/').pop() || '').toLowerCase();
    if (base === 'tasks.md') {
      return { role: 'tasks', label: '任务清单', accent: 'tasks' };
    }
    if (base === 'requirement.md') {
      return { role: 'requirement', label: '需求摘录', accent: 'requirement' };
    }
    if (base === 'design.md') {
      return { role: 'design', label: '设计摘录', accent: 'design' };
    }
    return { role: 'other', label: '拆分文件', accent: 'other' };
  }

  function sortSplitOutputPaths(paths) {
    const order = { requirement: 0, design: 1, tasks: 2, other: 3 };
    return paths.slice().sort((a, b) => {
      const ra = splitOutputFileRole(a).role;
      const rb = splitOutputFileRole(b).role;
      const oa = order[ra] !== undefined ? order[ra] : order.other;
      const ob = order[rb] !== undefined ? order[rb] : order.other;
      if (oa !== ob) {
        return oa - ob;
      }
      return a.localeCompare(b);
    });
  }

  /** tasks.md 子任务：展示从行内解析的 AC-x / TC-x（与 taskContext.parseTasksMdItems 一致） */
  function taskAcTcBadgesHtml(t) {
    const ac = Array.isArray(t.acRefs) ? t.acRefs : [];
    const tc = Array.isArray(t.tcRefs) ? t.tcRefs : [];
    if (!ac.length && !tc.length) {
      return '';
    }
    const bits = [
      ...ac.map((a) => `<span class="gk-trace-badge gk-trace-ac">${esc(String(a))}</span>`),
      ...tc.map((x) => `<span class="gk-trace-badge gk-trace-tc">${esc(String(x))}</span>`),
    ];
    return `<div class="gk-split-task-trace" aria-label="AC / TC">${bits.join('')}</div>`;
  }

  function renderSplitCanvas() {
    const el = document.querySelector('[data-panel="tasks"]');
    if (!el) {
      return;
    }
    const bundles = scan.specSplitBundles || [];
    const derived = scan.specDerivedFrom || {};
    const { tasks: orphanTasks, design: orphanDesign } = collectOrphanSplitFiles();
    let body = '';
    if (!bundles.length && !(scan.specs || []).length) {
      body = '<p class="gk-empty">暂无 Spec，无法串联拆分。请先创建 Spec 或刷新扫描。</p>';
    } else {
      body = bundles
        .map((b) => {
          const prop = derived[b.specPath];
          const kdir = splitKrioDirForSpec(b.specPath);
          const specBase = b.specPath.split('/').pop() || b.specPath;
          const sortedOut = sortSplitOutputPaths(b.krioRelPaths);
          const proposalBlock = prop
            ? `<div class="gk-split-doc-card gk-split-doc-card--proposal">
                <span class="gk-split-doc-badge">上游</span>
                <div class="gk-split-doc-title">Proposal</div>
                <p class="gk-split-doc-path"><code>${esc(prop)}</code></p>
                <div class="gk-split-doc-actions">
                  <button type="button" class="primary sm" data-open="${esc(prop)}">打开</button>
                  <button type="button" class="ghost sm" data-jump-prop="${esc(prop)}">Proposal 页</button>
                </div>
              </div>
              <div class="gk-split-stack-join" aria-hidden="true"><span class="gk-split-stack-join-line"></span><span class="gk-split-stack-join-arrow">↓</span></div>`
            : `<div class="gk-split-doc-card gk-split-doc-card--proposal gk-split-doc-card--muted">
                <span class="gk-split-doc-badge gk-split-doc-badge--muted">上游</span>
                <div class="gk-split-doc-title">Proposal</div>
                <p class="gk-note" style="margin:0;font-size:0.78em;">未解析到 <code>derived_from</code>，可在 Spec 头信息中指向 Proposal。</p>
              </div>
              <div class="gk-split-stack-join" aria-hidden="true"><span class="gk-split-stack-join-line"></span><span class="gk-split-stack-join-arrow">↓</span></div>`;
          const specBlock = `<div class="gk-split-doc-card gk-split-doc-card--spec">
              <span class="gk-split-doc-badge gk-split-doc-badge--spec">拆分依据</span>
              <div class="gk-split-doc-title">Spec</div>
              <p class="gk-split-doc-path"><code>${esc(b.specPath)}</code></p>
              <p class="gk-split-doc-hint">拆分任务与清单<strong>基于本 Spec</strong>生成，并与左侧 Proposal（若有）形成追溯链。</p>
              <div class="gk-split-doc-actions">
                <button type="button" class="primary sm" data-open="${esc(b.specPath)}">打开 Spec</button>
              </div>
            </div>`;
          const outCards =
            sortedOut.length > 0
              ? sortedOut
                  .map((f) => {
                    const meta = splitOutputFileRole(f);
                    const fname = f.split('/').pop() || f;
                    const taskItems = meta.accent === 'tasks' ? b.taskItems || [] : [];
                    const taskSubHtml =
                      meta.accent === 'tasks'
                        ? taskItems.length > 0
                          ? `<div class="gk-split-task-children" role="group" aria-label="tasks.md 子任务">
                        ${taskItems
                          .map(
                            (t) => `<div class="gk-split-task-mini">
                          <div class="gk-split-task-mini-body">
                            <span class="gk-split-task-mini-id">${esc(t.id)}</span>
                            <span class="gk-split-task-mini-title">${esc(t.title)}</span>
                            ${taskAcTcBadgesHtml(t)}
                          </div>
                          <div class="gk-split-task-mini-bar">
                            <button type="button" class="primary sm" data-fill-split-task="chat" data-task-spec="${esc(b.specPath)}" data-task-md="${esc(f)}" data-task-line="${t.lineNo}">填入对话</button>
                            <button type="button" class="ghost sm" data-fill-split-task="quest" data-task-spec="${esc(b.specPath)}" data-task-md="${esc(f)}" data-task-line="${t.lineNo}">填入 Quest</button>
                          </div>
                        </div>`
                          )
                          .join('')}
                      </div>`
                          : `<p class="gk-note gk-split-task-empty">未解析到 <code>- [ ]</code> 任务行。请使用 <code>- [ ] **T1** 描述</code>；可在描述中写 <code>AC-1</code>、<code>TC-XXX</code> 以便子卡片展示追溯。填入对话 / Quest 时也会带入 AC/TC 小节。</p>`
                        : '';
                    return `<div class="gk-split-spoke" data-accent="${esc(meta.accent)}">
                    <span class="gk-split-spoke-stem" aria-hidden="true"></span>
                    <article class="gk-split-out-card gk-split-out-card--${esc(meta.accent)}">
                      <div class="gk-split-out-card-head">
                        <span class="gk-split-out-kind">${esc(meta.label)}</span>
                        <span class="gk-split-out-filename">${esc(fname)}</span>
                      </div>
                      <p class="gk-split-out-path"><code>${esc(f)}</code></p>
                      <div class="gk-split-out-actions">
                        <button type="button" class="primary sm" data-open="${esc(f)}">打开</button>
                      </div>
                    </article>
                    ${taskSubHtml}
                  </div>`;
                  })
                  .join('')
              : `<div class="gk-split-out-empty">
              <p class="gk-note" style="margin:0;">暂无拆分文件。冻结 Spec 后在「流程」页执行<strong>拆分三文件</strong>，将在此出现 <code>requirement</code> / <code>design</code> / <code>tasks</code> 等卡片。</p>
            </div>`;
          return `<article class="gk-split-spec-card" data-link-path="${esc(b.specPath)}">
            <header class="gk-split-card-head">
              <div>
                <p class="gk-split-card-kicker">Tasks 画布</p>
                <p class="gk-split-kdir"><code>${esc(kdir)}</code> · ${b.krioRelPaths.length} 个文件</p>
              </div>
              <div class="gk-split-quick">
                <button type="button" class="ghost sm" data-jump-wf-split="${esc(b.specPath)}">去流程·操作</button>
                <button type="button" class="ghost sm" data-jump-spec-tab="${esc(b.specPath)}">Spec 画布</button>
              </div>
            </header>
            <div class="gk-split-flow-body">
              <div class="gk-split-col gk-split-col--upstream" aria-label="上游文档">
                <p class="gk-split-col-label">左侧 · 关联规约</p>
                <div class="gk-split-upstream-stack">
                  ${proposalBlock}
                  ${specBlock}
                </div>
              </div>
              <div class="gk-split-col gk-split-col--bridge" aria-hidden="true">
                <div class="gk-split-bridge-track"></div>
                <span class="gk-split-bridge-arrow" title="基于 Spec 展开">⤳</span>
              </div>
              <div class="gk-split-col gk-split-col--downstream" aria-label="拆分产物">
                <p class="gk-split-col-label">右侧 · 拆分产物（卡片 / 分支）</p>
                <div class="gk-split-mind-board">
                  <div class="gk-split-hub">
                    <span class="gk-split-hub-ring"></span>
                    <span class="gk-split-hub-label">自 Spec 展开</span>
                    <span class="gk-split-hub-spec">${esc(specBase)}</span>
                  </div>
                  <div class="gk-split-hub-bar" aria-hidden="true"></div>
                  <div class="gk-split-mind-branches">${outCards}</div>
                </div>
              </div>
            </div>
          </article>`;
        })
        .join('');
    }
    const orphanHtml =
      orphanTasks.length || orphanDesign.length
        ? `<div class="gk-split-orphan">
        <h4 class="gk-split-orphan-h">未归入上述拆分目录的 tasks / design</h4>
        <p class="gk-note">可能为全局任务池或其它目录约定。</p>
        ${
          orphanTasks.length
            ? `<div class="gk-split-orphan-block"><strong>tasks</strong><div class="gk-split-chip-wrap">${orphanTasks
                .map(
                  (f) =>
                    `<button type="button" class="gk-split-chip gk-split-chip--orphan" data-open="${esc(f)}">${esc(f)}</button>`
                )
                .join('')}</div></div>`
            : ''
        }
        ${
          orphanDesign.length
            ? `<div class="gk-split-orphan-block"><strong>design</strong><div class="gk-split-chip-wrap">${orphanDesign
                .map(
                  (f) =>
                    `<button type="button" class="gk-split-chip gk-split-chip--orphan" data-open="${esc(f)}">${esc(f)}</button>`
                )
                .join('')}</div></div>`
            : ''
        }
      </div>`
        : '';
    el.innerHTML = `
      <div class="gk-split-page-banner">
        <p class="gk-spec-banner-label">Tasks · Flow Canvas</p>
        <p class="gk-hint" style="margin:0;">本 Tab 以 Spec 为基准展示 <code>krio-*</code> 产物：<code>tasks.md</code> 中每条 <code>- [ ]</code> 会拆成<strong>子任务卡片</strong>，可<strong>填入对话</strong>或<strong>填入 Quest</strong>；默认<strong>不通过终端执行</strong>。左侧为 Proposal + Spec，右侧为分支文件与子任务。</p>
      </div>
      <div class="gk-split-surface">${body}</div>
      ${orphanHtml}
    `;
    el.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openFile', payload: btn.getAttribute('data-open') });
      });
    });
    el.querySelectorAll('[data-jump-prop]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-jump-prop');
        if (p) {
          setLinkedFocusPath(p);
        }
        activeTab = 'proposal';
        errMsg = '';
        render();
      });
    });
    el.querySelectorAll('[data-jump-wf-split]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-jump-wf-split');
        if (p) {
          setLinkedFocusPath(p);
        }
        activeTab = 'flow';
        errMsg = '';
        render();
      });
    });
    el.querySelectorAll('[data-jump-spec-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-jump-spec-tab');
        if (p) {
          setLinkedFocusPath(p);
        }
        activeTab = 'spec';
        errMsg = '';
        render();
      });
    });
    el.querySelectorAll('.gk-split-spec-card').forEach((card) => {
      card.addEventListener('click', () => {
        const p = card.getAttribute('data-link-path');
        if (p) {
          setLinkedFocusPath(p);
        }
      });
    });
    el.querySelectorAll('[data-fill-split-task]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const mode = btn.getAttribute('data-fill-split-task');
        const specPath = btn.getAttribute('data-task-spec');
        const tasksMdPath = btn.getAttribute('data-task-md');
        const line = parseInt(btn.getAttribute('data-task-line'), 10);
        if (!mode || !specPath || !tasksMdPath || !Number.isFinite(line)) {
          return;
        }
        vscode.postMessage({
          type: 'fillSplitTaskContext',
          payload: { mode, specPath, tasksMdPath, taskLineNo: line },
        });
      });
    });
  }

  /** 步骤引导画布（嵌入「流程」页上半区） */
  function renderCanvasInto(hostEl) {
    if (!hostEl) {
      return;
    }
    const cur = Math.min(Math.max(0, state.currentStep || 0), STEPS.length - 1);
    const step = STEPS[cur];
    const placement = document.body.getAttribute('data-placement') === 'editor' ? 'editor' : 'sidebar';
    const canvasClass = placement === 'editor' ? 'gk-canvas gk-canvas--hub' : 'gk-canvas gk-canvas--stack';

    const cardsHtml = STEPS.map((_, i) => {
      const card = renderOneCard(i, cur);
      const join =
        placement !== 'editor' && i < STEPS.length - 1
          ? '<div class="gk-canvas-join" aria-hidden="true">↓</div>'
          : '';
      return card + join;
    }).join('');

    hostEl.innerHTML = `
      <div class="gk-spec-banner">
        <p class="gk-spec-banner-label">Spec 驱动 · 步骤引导</p>
        <p class="gk-spec-banner-text">${esc(SPEC_NARRATIVE)}</p>
        <p class="gk-note gk-spec-dir-hint">多套 Proposal/Spec 建议分目录；只读样例见「示例与脚手架」。<strong>验收标准（AC）</strong>写在 Spec 正文（第 2 步）；<strong>过门禁、冻结、生成 krio-*</strong>请切到<strong>「流程」</strong>页下半区（流程操作）。</p>
      </div>
      <div class="gk-canvas-surface">
        <div class="${canvasClass}">
          ${cardsHtml}
        </div>
      </div>
      <section class="gk-focus">
        <div class="gk-focus-head">
          <h3 class="gk-focus-title">${esc(step.title)}</h3>
          <button type="button" class="ghost sm" data-toggle-skip="${cur}">${isSkipped(cur) ? '取消跳过' : '本步跳过'}</button>
        </div>
        <p class="gk-hint">${esc(step.hint)}</p>
        <details class="gk-term">
          <summary>「${esc(step.concept.split('（')[0])}」说明</summary>
          <p>${esc(step.explain)}</p>
        </details>
        ${renderCustomTemplatePickers(cur)}
        <p class="gk-note">状态：<code>.gluekit/workbench.json</code>（第 4 步门禁自检勾选也在上方卡片内）</p>
      </section>
    `;

    bindCanvasPanel(hostEl);
  }

  function renderWorkflowPreviewHtml() {
    const wp = workflowFilePreview;
    const touched = !!(wp.path || wp.loading || wp.error || wp.text);
    if (!touched) {
      return `<div class="gk-wf-doc-preview gk-wf-doc-preview--empty">
        <h3 class="gk-wf-doc-preview-h">门禁对照 · 文内预览</h3>
        <p class="gk-note" style="margin:0;">在上方 <strong>Proposal / Spec</strong> 卡片点<strong>文内预览</strong>，此处加载正文摘录（约前 80 行，可截断），便于对照清单<strong>无需离开本面板</strong>。人工：逐条看正文；AI：到对应文档 Tab 使用「复制 AI 提示词」粘贴到 Chat，结论仍须负责人点「通过」。</p>
      </div>`;
    }
    const loading = wp.loading;
    const err = wp.error;
    const txt = !loading && !err ? wp.text : '';
    const trunc = wp.truncated && !loading && !err;
    return `<div class="gk-wf-doc-preview">
      <h3 class="gk-wf-doc-preview-h">文内预览 <code class="gk-wf-doc-preview-path">${esc(wp.path)}</code></h3>
      ${
        loading
          ? '<p class="gk-hint">正在加载…</p>'
          : err
            ? `<p class="gk-error">${esc(err)}</p>`
            : txt
              ? `<pre class="gk-wf-doc-preview-pre" tabindex="0">${esc(txt)}${
                  trunc ? '\n\n… 已截断，请用卡片上「打开全文」' : ''
                }</pre>`
              : '<p class="gk-hint">无内容</p>'
      }
    </div>`;
  }

  function buildWorkflowHtml() {
    const proposals = scan.proposals || [];
    const specs = scan.specs || [];
    let html = `<div class="gk-workflow-intro">
      <p class="gk-hint"><strong>推荐流程</strong>：Proposal 自检/小组或 AI 辅助评审 → <strong>通过 Proposal 门禁</strong> → <strong>生成 Spec 草稿</strong>，在编辑器用 AI 结合 <code>derived_from</code> 引用 Proposal 填充各节（含<strong>验收标准 AC</strong>章节）→ <strong>通过 Spec v1.0 门禁</strong> → <strong>冻结 v1.0</strong>（把文件头 <code>status</code> 改为 <code>frozen</code>）→ 再<strong>生成 krio-* 三文件</strong>，在 <strong>Tasks</strong> Tab 查看与跟踪。</p>
      <p class="gk-note">AC 在 Spec 文档内设计与迭代，不是冻结后另写。冻结后若需大改 Spec，建议新开 Proposal。tasks.md 中行尾 <code>&lt;!-- gk:run:命令 --&gt;</code> 可在下方「加载可执行任务」后在终端执行（可选）。</p>
    </div>`;

    html += '<h4 class="gk-wf-h">Proposal</h4>';
    if (!proposals.length) {
      html += '<p class="gk-empty">暂无 Proposal</p>';
    }
    proposals.forEach((p) => {
      const ok = proposalGateOk(p);
      html += `<div class="gk-workflow-card gk-wf-proposal-card" data-link-path="${esc(p)}"><div class="gk-wf-row"><button type="button" class="gk-file" data-open="${esc(p)}">${esc(p)}</button>
        <span class="gk-badge ${ok ? 'ok' : 'bad'}">${ok ? '门禁已通过' : '待过门禁'}</span></div>
        <div class="gk-wf-check-guide">
        <p class="gk-wf-check-guide-title">如何检查</p>
        <ul class="gk-wf-mini">
          <li><strong>人工</strong>：打开正文，对照模板中的背景、目标、范围、风险与门禁清单。</li>
          <li><strong>AI</strong>：打开「Proposal」Tab，在卡片侧使用「复制 AI 提示词」粘贴到 Chat 预审；仍须负责人点「通过 Proposal 门禁」。</li>
        </ul>
        <div class="gk-row gk-wf-preview-actions">
          <button type="button" class="ghost sm" data-wf-preview="${esc(p)}">文内预览</button>
          <button type="button" class="ghost sm" data-open="${esc(p)}">打开全文</button>
        </div></div>
        <div class="gk-row">${
          ok
            ? `<button type="button" class="ghost sm" data-prop-revoke="${esc(p)}">撤销门禁</button><button type="button" class="primary sm" data-spec-from="${esc(p)}">生成 Spec 草稿</button>`
            : `<button type="button" class="primary sm" data-prop-pass="${esc(p)}">通过 Proposal 门禁</button>`
        }</div></div>`;
    });

    html += '<h4 class="gk-wf-h">Spec · 冻结 · 生成 Tasks 目录</h4>';
    if (!specs.length) {
      html += '<p class="gk-empty">暂无 Spec</p>';
    }
    specs.forEach((p) => {
      const sg = specGateOk(p);
      const fr = specFileFrozen(p);
      const canSplit = sg && fr;
      html += `<div class="gk-workflow-card gk-wf-spec-card" data-link-path="${esc(p)}"><div class="gk-wf-row"><button type="button" class="gk-file" data-open="${esc(p)}">${esc(p)}</button>
        <span class="gk-badge ${sg ? 'ok' : 'warn'}">${sg ? 'Spec 门禁已过' : 'Spec 门禁未过'}</span>
        <span class="gk-badge ${fr ? 'ok' : 'bad'}">${fr ? '已冻结' : '未冻结'}</span></div>
        <div class="gk-wf-check-guide">
        <p class="gk-wf-check-guide-title">如何检查 · 验收标准在哪</p>
        <ul class="gk-wf-mini">
          <li><strong>AC 在哪个环节？</strong>在<strong>第 2 步 Spec 文档正文</strong>的验收标准章节撰写与迭代；门禁是对「AC + 方案」是否可对齐、可测做确认，不是另起文档。</li>
          <li><strong>人工</strong>：点「文内预览」或「打开全文」，逐条对照 AC。</li>
          <li><strong>AI</strong>：到「Spec」Tab 用文档侧能力辅助审阅；仍须负责人点「通过 Spec v1.0 门禁」。</li>
        </ul>
        <div class="gk-row gk-wf-preview-actions">
          <button type="button" class="ghost sm" data-wf-preview="${esc(p)}">文内预览</button>
          <button type="button" class="ghost sm" data-open="${esc(p)}">打开全文</button>
          <button type="button" class="ghost sm" data-jump-tab="tasks">打开 Tasks Tab</button>
        </div></div>
        <div class="gk-row">${
          sg
            ? `<button type="button" class="ghost sm" data-spec-revoke="${esc(p)}">撤销 Spec 门禁</button>`
            : `<button type="button" class="primary sm" data-spec-pass="${esc(p)}">通过 Spec v1.0 门禁</button>`
        }${
          fr
            ? ''
            : ` <button type="button" class="primary sm" data-freeze="${esc(p)}" ${sg ? '' : 'disabled'}>冻结 v1.0</button>`
        }
        <button type="button" class="ghost sm" data-split="${esc(p)}" ${canSplit ? '' : 'disabled'} title="需先通过 Spec 门禁并冻结">生成拆分三文件</button>
        <button type="button" class="ghost sm" data-list-run="${esc(p)}">加载可执行任务</button></div>`;
      if (workflowRunnable && workflowRunnable.spec === p && workflowRunnable.tasks && workflowRunnable.tasks.length) {
        html += `<div class="gk-wf-runlist">${workflowRunnable.tasks
          .map(
            (t) =>
              `<button type="button" class="ghost sm" data-run-cmd="${esc(t.cmd)}">运行：${esc(t.label)}</button>`
          )
          .join(' ')}</div>`;
      }
      html += '</div>';
    });

    return html;
  }

  function bindWorkflowPanel(scopeEl) {
    if (!scopeEl) {
      return;
    }
    scopeEl.querySelectorAll('.gk-wf-proposal-card, .gk-wf-spec-card').forEach((card) => {
      card.addEventListener('click', (ev) => {
        const t = ev.target;
        if (t instanceof HTMLElement && t.closest('button, textarea, input, select, a, pre')) {
          return;
        }
        const path = card.getAttribute('data-link-path');
        if (path) {
          setLinkedFocusPath(path);
        }
      });
    });
    scopeEl.querySelectorAll('[data-wf-preview]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const path = btn.getAttribute('data-wf-preview');
        if (!path) {
          return;
        }
        workflowFilePreview = { path, text: '', truncated: false, error: '', loading: true };
        vscode.postMessage({
          type: 'previewTextFile',
          payload: { path, maxLines: 88, maxChars: 9000, channel: 'workflow' },
        });
      });
    });
    scopeEl.querySelectorAll('[data-jump-tab]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const tab = btn.getAttribute('data-jump-tab');
        if (tab) {
          activeTab = tab;
          errMsg = '';
          render();
        }
      });
    });
    scopeEl.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({ type: 'openFile', payload: btn.getAttribute('data-open') });
      });
    });
    scopeEl.querySelectorAll('[data-prop-pass]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({
          type: 'proposalGateSet',
          payload: { path: btn.getAttribute('data-prop-pass'), passed: true },
        });
      });
    });
    scopeEl.querySelectorAll('[data-prop-revoke]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({
          type: 'proposalGateSet',
          payload: { path: btn.getAttribute('data-prop-revoke'), passed: false },
        });
      });
    });
    scopeEl.querySelectorAll('[data-spec-from]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({ type: 'createSpecFromProposal', payload: btn.getAttribute('data-spec-from') });
      });
    });
    scopeEl.querySelectorAll('[data-spec-pass]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({
          type: 'specGateSet',
          payload: { path: btn.getAttribute('data-spec-pass'), passed: true },
        });
      });
    });
    scopeEl.querySelectorAll('[data-spec-revoke]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({
          type: 'specGateSet',
          payload: { path: btn.getAttribute('data-spec-revoke'), passed: false },
        });
      });
    });
    scopeEl.querySelectorAll('[data-freeze]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({ type: 'freezeSpec', payload: btn.getAttribute('data-freeze') });
      });
    });
    scopeEl.querySelectorAll('[data-split]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({ type: 'splitFromSpec', payload: btn.getAttribute('data-split') });
      });
    });
    scopeEl.querySelectorAll('[data-list-run]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({ type: 'getRunnableTasks', payload: btn.getAttribute('data-list-run') });
      });
    });
    scopeEl.querySelectorAll('[data-run-cmd]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({ type: 'runShell', payload: btn.getAttribute('data-run-cmd') });
      });
    });
  }

  function renderFlowPanel() {
    const el = document.querySelector('[data-panel="flow"]');
    if (!el) {
      return;
    }
    el.innerHTML = `<div class="gk-flow-page">
      <section class="gk-flow-block gk-flow-block--guide" aria-label="步骤引导"></section>
      <hr class="gk-flow-sep" />
      <section class="gk-flow-block gk-flow-block--ops" aria-label="门禁、冻结与 Tasks 目录">
        <h2 class="gk-flow-section-title">流程操作（门禁 · 冻结 · Tasks）</h2>
        <div class="gk-flow-ops-body"></div>
      </section>
      <section class="gk-flow-block gk-flow-block--wf-preview" aria-label="文内预览">${renderWorkflowPreviewHtml()}</section>
    </div>`;
    const guide = el.querySelector('.gk-flow-block--guide');
    const opsBody = el.querySelector('.gk-flow-ops-body');
    renderCanvasInto(guide);
    if (opsBody) {
      opsBody.innerHTML = buildWorkflowHtml();
      bindWorkflowPanel(opsBody);
    }
  }

  function renderMapPanel() {
    const el = document.querySelector('[data-panel="map"]');
    if (!el) {
      return;
    }
    const rows = [
      ['Proposal', scan.proposals],
      ['Spec', scan.specs],
      ['契约 YAML', scan.contractFiles || []],
      ['入门示例 gluekit-examples', scan.examples || []],
      ['tasks', scan.tasks],
      ['design', scan.design],
      ['部署 deployment', scan.deploymentDocs || []],
      ['追溯 traceability', scan.traceabilityDocs || []],
      ['CHANGELOG', scan.changelogFiles || []],
      ['AGENTS / reference', [...scan.agents, ...scan.references]],
      ['CI 线索', scan.ciHints],
      ['.qoder（项目级）', scan.qoderFiles || []],
    ];
    const jumpBtns = TABS.filter((t) => t.id !== 'map')
      .map(
        (t) =>
          `<button type="button" class="ghost sm gk-map-jump-btn" data-map-jump="${esc(t.id)}">${esc(t.label)}</button>`
      )
      .join('');
    el.innerHTML = `
      <div class="gk-map-banner">
        <p class="gk-spec-banner-label">仓库地图</p>
        <p class="gk-hint" style="margin:0;">扫描结果速览（glob 见文档）。规约类配套见 <strong>规约配套</strong> Tab；详细编辑请在 <strong>Proposal / Spec / Tasks</strong> 等页操作。</p>
      </div>
      <div class="gk-map-jumps" role="navigation" aria-label="快捷跳转">
        <span class="gk-map-jumps-label">跳转</span>
        <div class="gk-map-jumps-row">${jumpBtns}</div>
      </div>
      <div class="gk-map-stats">
      ${rows
        .map(([label, arr]) => {
          const ok = arr.length > 0;
          return `<div class="gk-map-stat-row">
            <strong>${esc(label)}</strong>
            <span class="gk-badge ${ok ? 'ok' : 'bad'}">${ok ? arr.length + ' 个' : '未发现'}</span>
          </div>`;
        })
        .join('')}
      </div>
    `;
    el.querySelectorAll('[data-map-jump]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-map-jump') || 'flow';
        errMsg = '';
        render();
      });
    });
  }

  function renderMaterialsPanel() {
    const el = document.querySelector('[data-panel="materials"]');
    if (!el) {
      return;
    }
    const dep = scan.deploymentDocs || [];
    const tr = scan.traceabilityDocs || [];
    const cl = scan.changelogFiles || [];
    const contracts = scan.contractFiles || [];
    const design = scan.design || [];
    const sgm = scan.specGluekitMaterial || {};
    const specs = scan.specs || [];

    function chipSection(title, files) {
      if (!files.length) {
        return `<div class="gk-mat-section">
          <div class="gk-mat-row-head"><strong>${esc(title)}</strong> <span class="gk-badge bad">未发现</span></div>
        </div>`;
      }
      const chips = files
        .map((f) => {
          const base = f.split('/').pop() || f;
          return `<button type="button" class="gk-chip gk-mat-chip" data-open="${esc(f)}" title="${esc(f)}">${esc(base)}</button>`;
        })
        .join('');
      return `<div class="gk-mat-section">
        <div class="gk-mat-row-head"><strong>${esc(title)}</strong> <span class="gk-badge ok">${files.length}</span></div>
        <div class="gk-mat-chips">${chips}</div>
      </div>`;
    }

    let specBlocks = '';
    specs.forEach((sp) => {
      const mats = sgm[sp];
      if (!mats || !mats.length) {
        return;
      }
      const base = sp.split('/').pop() || sp;
      specBlocks += `<article class="gk-mat-spec-card" data-link-path="${esc(sp)}">
        <header class="gk-mat-spec-head">
          <button type="button" class="gk-file gk-mat-spec-title" data-open="${esc(sp)}">${esc(base)}</button>
        </header>
        <p class="gk-note" style="margin:6px 0 8px;">frontmatter <code>gluekit_material</code></p>
        <div class="gk-mat-chips">${mats
          .map((p) => {
            const b = p.split('/').pop() || p;
            return `<button type="button" class="gk-chip gk-mat-chip" data-open="${esc(p)}" title="${esc(p)}">${esc(b)}</button>`;
          })
          .join(' ')}</div>
      </article>`;
    });

    el.innerHTML = `
      <div class="gk-mat-banner">
        <p class="gk-spec-banner-label">Spec Coding · 规约配套</p>
        <p class="gk-hint" style="margin:0;">汇总<strong>契约、设计（含 ADR）、部署、变更记录、追溯矩阵</strong>的扫描结果，以及各 Spec 声明的 <code>gluekit_material</code>。与 <strong>Tasks</strong> 并行：先定规约与配套文档，再拆任务执行。</p>
      </div>
      <section class="gk-mat-flow" aria-label="推荐顺序">
        <span class="gk-mat-flow-label">推荐顺序</span>
        <ol class="gk-mat-flow-ol">
          <li>Proposal → Spec（含 AC）</li>
          <li>契约 · 实现设计 · ADR</li>
          <li>部署 · CHANGELOG · Task/AC/TC 矩阵</li>
          <li>冻结 → krio-* → Tasks</li>
        </ol>
      </section>
      <h3 class="gk-mat-h">仓库扫描汇总</h3>
      <div class="gk-mat-grid">
        ${chipSection('契约 / OpenAPI（YAML）', contracts)}
        ${chipSection('设计文档（design，含 adr）', design)}
        ${chipSection('部署文档', dep)}
        ${chipSection('追溯 traceability', tr)}
        ${chipSection('CHANGELOG', cl)}
      </div>
      <h3 class="gk-mat-h">各 Spec 的 gluekit_material</h3>
      ${
        specBlocks ||
        '<p class="gk-empty">暂无 Spec 在 frontmatter 中声明 <code>gluekit_material</code> 列表。可将契约、部署说明等路径写成 YAML 列表挂载。</p>'
      }
    `;

    el.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({ type: 'openFile', payload: btn.getAttribute('data-open') });
      });
    });
    el.querySelectorAll('.gk-mat-spec-card').forEach((card) => {
      card.addEventListener('click', (ev) => {
        if (ev.target instanceof HTMLElement && ev.target.closest('button')) {
          return;
        }
        const p = card.getAttribute('data-link-path');
        if (p) {
          setLinkedFocusPath(p);
        }
      });
    });
  }

  const SCAFFOLD_KITS = [
    {
      kind: 'spec',
      title: 'Spec Coding',
      subtitle: '仅 Proposal + Spec',
      desc: '在独立子目录内生成最小 proposals/ 与 specs/，Spec 已填 derived_from 指向上游 Proposal，便于流程与扫描串联。',
      tree: [
        { path: 'README.md', note: '说明与迁移提示' },
        { path: 'proposals/sample/proposal.md', note: 'Proposal 试写' },
        { path: 'specs/sample/feature-spec.md', note: 'Spec 草稿 · 绑定上游' },
      ],
    },
    {
      kind: 'glue',
      title: 'Glue Coding',
      subtitle: 'AGENTS + reference',
      desc: 'Agent 侧导航：根级 AGENTS.md、reference/README.md 与 snippets 占位，适合与 Cursor @ 引用配合。',
      tree: [
        { path: 'README.md', note: '用途说明' },
        { path: 'AGENTS.md', note: '导航地图索引' },
        { path: 'reference/README.md', note: '物料库说明' },
        { path: 'reference/snippets.md', note: '片段 / 提示词占位' },
      ],
    },
    {
      kind: 'harness',
      title: 'Harness 框架',
      subtitle: '建议整仓布局',
      desc: '与 Harness 页「一键初始化」相同内容，但写入独立子目录：docs/、scripts/、harness/ 等占位，不触碰仓库根已有文件。',
      tree: [
        { path: 'README.md', note: '沙箱说明' },
        { path: 'AGENTS.md', note: '导航地图' },
        { path: 'docs/ARCHITECTURE.md', note: '架构' },
        { path: 'docs/DEVELOPMENT.md', note: '开发与验证' },
        { path: 'scripts/validate.py', note: '验证管道占位' },
        { path: 'harness/tasks/', note: '任务留痕目录' },
        { path: '…', note: '其余项与 Harness 初始化一致' },
      ],
    },
  ];

  function renderExamples() {
    const el = document.querySelector('[data-panel="examples"]');
    if (!el) {
      return;
    }
    const files = scan.examples || [];
    const manifest = scan.exampleManifest || {};

    let html = `<div class="gk-examples-scaffold">
      <p class="gk-hint gk-scaffold-intro"><strong>可写脚手架</strong>：在工作区根目录下新建文件夹，名称格式为 <code>gluekit-scaffold-&lt;类型&gt;-&lt;日期时间&gt;-&lt;随机4位十六进制&gt;</code>，每次点击「创建」都会得到<strong>新目录</strong>，不会覆盖历史试写。</p>
      <div class="gk-scaffold-surface" aria-label="脚手架画布">`;

    html += SCAFFOLD_KITS.map(
      (k) => `<article class="gk-scaffold-card" data-scaffold-kind="${esc(k.kind)}">
        <header class="gk-scaffold-card-head">
          <h4 class="gk-scaffold-card-title">${esc(k.title)}</h4>
          <span class="gk-scaffold-card-tag">${esc(k.subtitle)}</span>
        </header>
        <p class="gk-scaffold-card-desc">${esc(k.desc)}</p>
        <div class="gk-scaffold-files" role="list">
          ${k.tree
            .map(
              (row) =>
                `<div class="gk-scaffold-file-row" role="listitem"><code class="gk-scaffold-path">${esc(row.path)}</code><span class="gk-scaffold-file-note">${esc(
                  row.note
                )}</span></div>`
            )
            .join('')}
        </div>
        <p class="gk-scaffold-row"><button type="button" class="primary" data-create-scaffold="${esc(k.kind)}">创建到工作区</button></p>
      </article>`
    ).join('');

    html += `</div></div>`;

    html += `<h3 class="gk-examples-section-title">只读示例 gluekit-examples</h3>
      <p class="gk-hint">标题与说明来自 <code>gluekit-examples/manifest.json</code>；下方按钮仅打开已有文件，不会在仓库中新建内容。</p>`;

    if (!files.length) {
      html += `<p class="gk-hint">未扫描到 <code>gluekit-examples/**/*.md</code>。将示例目录放在仓库根目录后点击「刷新扫描」。</p>`;
    } else {
      const groups = {};
      for (const f of files) {
        const m = f.match(/^gluekit-examples\/([^/]+)\/([^/]+\.md)$/);
        if (m) {
          const dir = m[1];
          groups[dir] = groups[dir] || [];
          groups[dir].push(f);
        } else if (f === 'gluekit-examples/README.md') {
          groups.__readme = groups.__readme || [];
          groups.__readme.push(f);
        }
      }
      const dirKeys = Object.keys(groups)
        .filter((k) => k !== '__readme')
        .sort();
      html += '<div class="gk-example-grid">';
      for (const dir of dirKeys) {
        const meta = manifest[dir] || {};
        const title = meta.title || dir;
        const desc = meta.desc || '';
        const list = (groups[dir] || []).slice().sort();
        html += `<div class="gk-example-card"><h4 class="gk-example-title">${esc(title)}</h4><p class="gk-example-desc">${esc(
          desc
        )}</p><div class="gk-example-actions">`;
        for (const path of list) {
          const base = (path.split('/').pop() || path).replace(/\.md$/i, '');
          let label = base;
          if (base.toLowerCase() === 'proposal') {
            label = 'Proposal';
          } else if (base.toLowerCase() === 'spec') {
            label = 'Spec';
          }
          html += `<button type="button" class="primary sm" data-open="${esc(path)}">打开 ${esc(label)}</button>`;
        }
        html += `</div><p class="gk-example-path"><code>${esc(dir)}/</code></p></div>`;
      }
      html += '</div>';
      if (groups.__readme && groups.__readme.length) {
        html += `<p class="gk-row"><button type="button" class="ghost" data-open="gluekit-examples/README.md">打开 README 说明</button></p>`;
      }
    }

    el.innerHTML = html;
    el.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openFile', payload: btn.getAttribute('data-open') });
      });
    });
    el.querySelectorAll('[data-create-scaffold]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-create-scaffold');
        vscode.postMessage({ type: 'createScaffold', payload: k });
      });
    });
  }

  function renderFilePanel(panelId, files, templateKind) {
    const el = document.querySelector(`[data-panel="${panelId}"]`);
    if (!el) {
      return;
    }
    const customs = customTemplatesFor(templateKind);
    const customBlock =
      customs.length > 0
        ? `<p class="gk-hint" style="margin-top:10px;">自定义模板（<code>.gluekit/templates/${templateKind}/</code>）</p><div class="gk-file-list">${customs
            .map(
              (t) =>
                `<button type="button" class="gk-file gk-tpl" data-custom-kind="${esc(templateKind)}" data-custom-src="${esc(t.source)}">${esc(t.label)}</button>`
            )
            .join('')}</div>`
        : '';
    el.innerHTML = `
      <div class="gk-row">
        <button type="button" class="primary" data-create="${esc(templateKind)}">内置模板</button>
      </div>
      ${customBlock}
      ${
        files.length
          ? `<div class="gk-file-list" style="margin-top:10px;">${files.map((f) => `<button type="button" class="gk-file" data-open="${esc(f)}">${esc(f)}</button>`).join('')}</div>`
          : '<p class="gk-empty">未发现匹配文件，可先使用上方模板。</p>'
      }
    `;
    el.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openFile', payload: btn.getAttribute('data-open') });
      });
    });
    el.querySelectorAll('[data-create]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'createFromTemplate', payload: btn.getAttribute('data-create') });
      });
    });
    bindCustomTemplateClicks(el);
  }

  function harnessLayoutCanvasHtml(guide) {
    const g = guide || [];
    const total = g.length;
    const presentN = g.filter((r) => r.present).length;
    const missingN = total - presentN;
    const sections = [
      { title: '根目录', pred: (r) => (r.depth || 0) === 0 },
      { title: 'docs/', pred: (r) => String(r.displayPath || '').startsWith('docs/') },
      { title: 'scripts/', pred: (r) => String(r.displayPath || '').startsWith('scripts/') },
      { title: 'harness/', pred: (r) => String(r.displayPath || '').startsWith('harness/') },
    ];
    let body = '';
    for (const sec of sections) {
      const items = g.filter(sec.pred);
      if (!items.length) {
        continue;
      }
      body += `<div class="gk-h-canvas-group"><div class="gk-h-canvas-group-title">${esc(sec.title)}</div><div class="gk-h-tiles">`;
      for (const row of items) {
        const st = row.present ? 'ok' : 'bad';
        const initBtn = row.present
          ? '<span class="gk-h-tile-ok" aria-hidden="true">✓</span>'
          : `<button type="button" class="primary sm" data-harness-init="${esc(row.id)}">创建</button>`;
        body += `<div class="gk-h-tile ${row.present ? 'is-present' : 'is-miss'}" data-hg-id="${esc(row.id)}">
          <div class="gk-h-tile-main">
            <code class="gk-h-tile-path">${esc(row.displayPath)}</code>
            <span class="gk-badge ${st}">${row.present ? '已有' : '缺失'}</span>
          </div>
          <p class="gk-h-tile-role">${esc(row.role)}</p>
          <div class="gk-h-tile-actions">${initBtn}</div>
        </div>`;
      }
      body += '</div></div>';
    }
    return `
      <div class="gk-harness-canvas">
        <div class="gk-h-canvas-head">
          <div>
            <p class="gk-h-canvas-kpi"><strong>${presentN}</strong> / ${total} 项已就绪</p>
            <p class="gk-note" style="margin:0;">仅创建<strong>缺失</strong>路径，不会覆盖已有文件。也可在下方列表中逐项展开后创建。</p>
          </div>
          <button type="button" class="primary" id="btn-harness-init-all" ${missingN === 0 ? 'disabled' : ''}>初始化全部缺失项</button>
        </div>
        <div class="gk-h-canvas-surface" aria-label="Harness 布局画布">${body || '<p class="gk-empty">无布局数据，请先刷新扫描。</p>'}</div>
      </div>
    `;
  }

  function glueHintForPath(rel) {
    const lower = rel.toLowerCase();
    if (/agents\.md$/i.test(lower)) {
      return '总导航：短索引，细节进 docs/';
    }
    if (lower.includes('reference')) {
      return '可抄范式 / 样例 / 团队约定片段';
    }
    return '上下文物料：编写或评审时打开';
  }

  function renderGlue() {
    const el = document.querySelector('[data-panel="glue"]');
    if (!el) {
      return;
    }
    const agents = scan.agents || [];
    const refs = scan.references || [];
    const agentsBlock =
      agents.length > 0
        ? `<div class="gk-glue-agents-stack">
        ${agents
          .map((f) => {
            const base = f.split('/').pop() || f;
            return `<div class="gk-glue-agent-card" data-link-path="${esc(f)}">
            <div class="gk-glue-agent-top">
              <span class="gk-glue-agent-icon" aria-hidden="true">◎</span>
              <div class="gk-glue-agent-meta">
                <span class="gk-glue-agent-name">${esc(base)}</span>
                <code class="gk-glue-agent-path">${esc(f)}</code>
              </div>
              <button type="button" class="primary sm" data-open="${esc(f)}">打开</button>
            </div>
            <p class="gk-glue-agent-hint">${esc(glueHintForPath(f))}</p>
            <button type="button" class="ghost sm" data-glue-copy-ref="${esc(f)}">复制 @引用 说明</button>
          </div>`;
          })
          .join('')}
      </div>`
        : '<p class="gk-empty">未发现 <code>AGENTS.md</code>。可在 Harness 页初始化导航地图。</p>';
    const refTiles =
      refs.length > 0
        ? `<div class="gk-glue-ref-mosaic">${refs
            .map((f) => {
              const base = f.split('/').pop() || f;
              return `<div class="gk-glue-ref-tile" data-link-path="${esc(f)}">
            <span class="gk-glue-ref-title">${esc(base)}</span>
            <code class="gk-glue-ref-path">${esc(f)}</code>
            <p class="gk-glue-ref-hint">${esc(glueHintForPath(f))}</p>
            <div class="gk-glue-ref-actions">
              <button type="button" class="ghost sm" data-open="${esc(f)}">打开</button>
              <button type="button" class="ghost sm" data-glue-copy-ref="${esc(f)}">@引用</button>
            </div>
          </div>`;
            })
            .join('')}</div>`
        : '<p class="gk-empty">未发现 <code>reference/**/*.md</code> 与 <code>references/**/*.md</code>。</p>';
    const refInitBar = `<div class="gk-glue-ref-init">
      <button type="button" class="primary sm" id="btn-glue-init-reference">初始化 reference/ 物料库</button>
      <p class="gk-note" style="margin:0;">在仓库根创建 <code>reference/README.md</code>（含说明模板）；已存在则<strong>不覆盖</strong>。扫描亦包含 <code>references/</code> 复数路径。</p>
    </div>`;
    el.innerHTML = `
      <div class="gk-glue-page">
        <div class="gk-glue-main">
          <div class="gk-glue-hero-banner">
            <p class="gk-glue-hero-kicker">Glue · 上下文物料</p>
            <p class="gk-hint" style="margin:0;">与 Proposal/Spec 一样偏画布化展示，但定位是<strong>资料架</strong>。<strong>AGENTS.md 全仓库通常只有一份</strong>：Glue 与 Harness 读的是<strong>同一文件</strong>——Harness 侧重整仓布局初始化与预览；Glue 侧重日常打开、复制 @ 引用。无需维护两份地图。</p>
          </div>
          <section class="gk-glue-section">
            <h4 class="gk-glue-section-title">AGENTS 导航</h4>
            <p class="gk-note" style="margin:0 0 10px;">与 Harness「导航地图预览」指向同一 <code>AGENTS.md</code>（扫描到的路径）。</p>
            ${agentsBlock}
          </section>
          <section class="gk-glue-section">
            <h4 class="gk-glue-section-title">reference 物料库</h4>
            ${refInitBar}
            ${refTiles}
          </section>
        </div>
        <aside class="gk-glue-rail" aria-label="Glue 使用提示">
          <h4 class="gk-glue-rail-title">怎么用</h4>
          <ul class="gk-glue-rail-list">
            <li><strong>AGENTS.md</strong>：一份文件，Glue / Harness 共用；Harness 可初始化模板与场景标签，Glue 方便点开与 @ 引用。</li>
            <li><strong>reference/</strong>：放长范式；点「初始化」只建 README 占位，不删你已有文件。</li>
            <li>Chat 里用 <code>@文件</code> 指向表中路径；「@引用」复制一句说明到剪贴板。</li>
            <li>与 Spec：Spec 管「做什么、怎么验收」；Glue 管「按什么风格写」。</li>
          </ul>
          <p class="gk-note">整仓目录脚手架请用 <strong>Harness 画布</strong>；仅补物料库请用本节按钮。</p>
        </aside>
      </div>
    `;
    el.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const path = btn.getAttribute('data-open');
        if (path) {
          setLinkedFocusPath(path);
        }
        vscode.postMessage({ type: 'openFile', payload: path });
      });
    });
    el.querySelectorAll('[data-glue-copy-ref]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const rel = btn.getAttribute('data-glue-copy-ref');
        if (rel) {
          vscode.postMessage({ type: 'copyGlueRefLine', payload: rel });
        }
      });
    });
    el.querySelectorAll('.gk-glue-agent-card, .gk-glue-ref-tile').forEach((node) => {
      node.addEventListener('click', () => {
        const p = node.getAttribute('data-link-path');
        if (p) {
          setLinkedFocusPath(p);
        }
      });
    });
    document.getElementById('btn-glue-init-reference')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'glueInitReference', payload: {} });
    });
  }

  /** 与 src/agentsPresets.ts 中 id 保持一致 */
  const AGENTS_SCENARIO_BTNS = [
    { id: 'research', label: '投研助手' },
    { id: 'ecommerce', label: '电商' },
    { id: 'education', label: '教育' },
    { id: 'saas', label: '通用 SaaS' },
  ];

  function renderHarness() {
    const el = document.querySelector('[data-panel="harness"]');
    if (!el) {
      return;
    }
    if (activeTab === 'harness') {
      requestAgentsPreview(false);
    }
    const links = (state.harnessLinks || []).join('\n');
    const guide = scan.harnessGuide || [];
    const guideRows = guide
      .map((row) => {
        const depth = row.depth || 0;
        const depthCls = depth > 0 ? 'gk-hg-row--nested' : '';
        const st = row.present ? 'ok' : 'bad';
        const stLabel = row.present ? '已有' : '未有';
        const revealP = row.openPath ? String(row.openPath) : '';
        const linkAttrs =
          revealP !== '' ? ` data-reveal-path="${esc(revealP)}" data-link-path="${esc(revealP)}"` : '';
        const openBtn = row.openPath
          ? `<button type="button" class="ghost sm" data-open="${esc(row.openPath)}">打开</button>`
          : row.present
            ? '<span class="gk-hg-folder-note">目录已存在</span>'
            : '';
        const initBtn = row.present
          ? ''
          : `<button type="button" class="primary sm" data-harness-init="${esc(row.id)}">创建模板</button>`;
        return `<div class="gk-hg-row ${depthCls}" data-hg-id="${esc(row.id)}"${linkAttrs}>
        <span class="gk-badge ${st} gk-hg-badge">${stLabel}</span>
        <div class="gk-hg-main">
          <details class="gk-hg-details">
            <summary class="gk-hg-summary">
              <code class="gk-hg-path">${esc(row.displayPath)}</code>
            </summary>
            <p class="gk-hg-role">${esc(row.role)}</p>
            <div class="gk-hg-actions">${openBtn}${initBtn ? ` ${initBtn}` : ''}</div>
          </details>
        </div>
      </div>`;
      })
      .join('');

    const ap = preferredAgentsPath();
    const agentsTargetPath = ap || 'AGENTS.md';
    const agentsPresetBar = `<div class="gk-agents-presets">
      <p class="gk-hint" style="margin-bottom:8px;">场景标签：向 <code>${esc(agentsTargetPath)}</code> <strong>追加</strong>对应段落（内置 HTML 注释标记去重）。若文件不存在会先写入<strong>基础导航模板</strong>再追加。</p>
      <div class="gk-agents-preset-row" role="group" aria-label="AGENTS 场景标签">
        ${AGENTS_SCENARIO_BTNS.map(
          (b) =>
            `<button type="button" class="ghost sm gk-agents-chip" data-agents-preset="${esc(b.id)}" data-agents-path="${esc(agentsTargetPath)}">${esc(b.label)}</button>`
        ).join('')}
      </div>
    </div>`;
    let previewBlock = '';
    if (!ap) {
      previewBlock = `${agentsPresetBar}<p class="gk-empty">当前仓库未扫描到根级 <code>AGENTS.md</code>（或仅有子路径副本）。可先点场景标签生成文件，或使用下方画布「初始化 AGENTS.md」。</p>
        <div class="gk-row" style="margin-top:8px;">
          <button type="button" class="primary sm" data-harness-init="agents">初始化 AGENTS.md 模板</button>
        </div>`;
    } else {
      const loading = filePreview.loading && filePreview.path === ap;
      const err = filePreview.error && filePreview.path === ap ? filePreview.error : '';
      const txt = !loading && !err && filePreview.path === ap ? filePreview.text : '';
      const trunc = filePreview.truncated && filePreview.path === ap;
      previewBlock = `
        ${agentsPresetBar}
        <div class="gk-agents-preview-head">
          <code class="gk-hg-path">${esc(ap)}</code>
          <div class="gk-row" style="margin:0;">
            <button type="button" class="ghost sm" data-open="${esc(ap)}">打开全文</button>
            <button type="button" class="ghost sm" id="btn-agents-preview-refresh">刷新预览</button>
          </div>
        </div>
        ${
          loading
            ? '<p class="gk-hint">正在加载预览…</p>'
            : err
              ? `<p class="gk-error">${esc(err)}</p>`
              : txt
                ? `<pre class="gk-preview-block" aria-label="AGENTS.md 预览">${esc(txt)}${
                    trunc ? '\n\n… 已截断，请使用「打开全文」' : ''
                  }</pre>`
                : '<p class="gk-hint">点击下方「刷新预览」加载导航地图摘要。</p>'
        }`;
    }

    el.innerHTML = `
      <section class="gk-harness-section">
        <h4 class="gk-harness-h">Harness 布局画布 · 初始化</h4>
        <p class="gk-hint">按目录分组展示建议结构；<strong>缺失</strong>项可点「创建」生成占位模板，或使用「初始化全部缺失项」。完成后点「刷新扫描」更新探测结果。</p>
        ${harnessLayoutCanvasHtml(guide)}
      </section>
      <section class="gk-harness-section">
        <h4 class="gk-harness-h">Harness 工程参考布局（详细）</h4>
        <p class="gk-hint">对照 Qoder「仓库是 Agent 的操作系统」。<strong>展开一行</strong>可在资源管理器中定位；与 Proposal 等同路径条目<strong>联动高亮</strong>。</p>
        <div class="gk-harness-guide">${guideRows || '<p class="gk-empty">暂无探测数据，请点击「刷新扫描」。</p>'}</div>
      </section>
      <section class="gk-harness-section">
        <h4 class="gk-harness-h">导航地图预览（AGENTS.md）</h4>
        ${previewBlock}
      </section>
      <section class="gk-harness-section">
        <h4 class="gk-harness-h">CI 与外链</h4>
        <p class="gk-hint">每行一个 URL（如 GitHub Actions、GitLab Pipeline）。可与仓库内 CI 文件对照。</p>
        <textarea class="gk-input" id="harness-links" placeholder="https://...">${esc(links)}</textarea>
        <div class="gk-row">
          <button type="button" class="primary" id="btn-save-links">保存链接</button>
        </div>
        <h4 style="margin:12px 0 6px;font-size:0.95em;">仓库内 CI 线索</h4>
        ${
          scan.ciHints.length
            ? `<div class="gk-file-list">${scan.ciHints.map((f) => `<button type="button" class="gk-file" data-open="${esc(f)}">${esc(f)}</button>`).join('')}</div>`
            : '<p class="gk-empty">未发现常见 CI 配置文件。</p>'
        }
      </section>
    `;
    document.getElementById('btn-save-links')?.addEventListener('click', () => {
      const raw = document.getElementById('harness-links').value;
      state.harnessLinks = raw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      persist();
      render();
    });
    document.getElementById('btn-agents-preview-refresh')?.addEventListener('click', () => {
      requestAgentsPreview(true);
      render();
    });
    el.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-open');
        if (path) {
          setLinkedFocusPath(path);
        }
        vscode.postMessage({ type: 'openFile', payload: path });
      });
    });
    document.getElementById('btn-harness-init-all')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'harnessInitAll', payload: {} });
    });
    el.querySelectorAll('[data-harness-init]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute('data-harness-init');
        if (id) {
          vscode.postMessage({ type: 'harnessInitItem', payload: { id } });
        }
      });
    });
    el.querySelectorAll('[data-agents-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-agents-preset');
        const path = btn.getAttribute('data-agents-path');
        if (preset && path) {
          vscode.postMessage({ type: 'appendAgentsPreset', payload: { preset, path } });
        }
      });
    });
    el.querySelectorAll('.gk-hg-details').forEach((det) => {
      det.addEventListener('toggle', () => {
        if (!det.open) {
          return;
        }
        const rowEl = det.closest('.gk-hg-row');
        const rp = rowEl && rowEl.getAttribute('data-reveal-path');
        if (rp) {
          vscode.postMessage({ type: 'revealInExplorer', payload: rp });
          setLinkedFocusPath(rp);
        }
      });
    });
  }

  function qoderTopSegment(rel) {
    const m = String(rel).replace(/\\/g, '/').match(/^\.qoder\/([^/]+)/);
    return m ? m[1] : 'other';
  }

  function requestQoderFilePreview(relPath) {
    qoderFilePreview = { path: relPath, text: '', truncated: false, error: '', loading: true };
    vscode.postMessage({
      type: 'previewTextFile',
      payload: { path: relPath, maxLines: 52, maxChars: 7200, channel: 'qoder' },
    });
    render();
  }

  function renderQoderPanel() {
    const el = document.querySelector('[data-panel="qoder"]');
    if (!el) {
      return;
    }
    const files = (scan.qoderFiles || []).slice().sort();
    const byCat = {};
    for (const f of files) {
      const c = qoderTopSegment(f);
      if (!byCat[c]) {
        byCat[c] = [];
      }
      byCat[c].push(f);
    }
    const catOrder = ['agents', 'skills', 'rules', 'logs', 'other'];
    const catLabels = {
      agents: 'agents（自定义 Agent）',
      skills: 'skills（技能包）',
      rules: 'rules（项目规则）',
      logs: 'logs（留痕日志）',
      other: '其他',
    };
    const sortedCats = [
      ...catOrder.filter((k) => byCat[k] && byCat[k].length),
      ...Object.keys(byCat).filter((k) => !catOrder.includes(k)).sort(),
    ];

    let listHtml = '';
    if (!files.length) {
      listHtml =
        '<p class="gk-empty">当前工作区未扫描到 <code>.qoder/**/*.md</code> 与 <code>.mdc</code>。可点击下方创建一条 GlueKit 规则模板（会生成 <code>.qoder/rules/</code>），然后点「刷新扫描」。</p>';
    } else {
      listHtml = sortedCats
        .map((cat) => {
          const arr = byCat[cat] || [];
          if (!arr.length) {
            return '';
          }
          const label = catLabels[cat] || cat;
          const rows = arr
            .map(
              (p) => `<div class="gk-qoder-row" data-qoder-path="${esc(p)}">
              <code class="gk-qoder-path">${esc(p)}</code>
              <span class="gk-qoder-actions">
                <button type="button" class="ghost sm" data-qoder-open="${esc(p)}">打开</button>
                <button type="button" class="ghost sm" data-qoder-preview="${esc(p)}">预览</button>
                <button type="button" class="ghost sm" data-qoder-reveal="${esc(p)}">侧栏定位</button>
              </span>
            </div>`
            )
            .join('');
          return `<section class="gk-qoder-group"><h4 class="gk-qoder-group-h">${esc(label)}</h4><div class="gk-qoder-list">${rows}</div></section>`;
        })
        .join('');
    }

    const qp = qoderFilePreview;
    const loading = qp.loading;
    const err = qp.error;
    const txt = !loading && !err ? qp.text : '';
    const trunc = qp.truncated;
    const previewHead = qp.path ? `<code class="gk-qoder-path">${esc(qp.path)}</code>` : '';
    const previewBlock =
      !qp.path && !loading
        ? '<p class="gk-hint">选中文件后点「预览」在此显示正文（只读）。</p>'
        : loading
          ? '<p class="gk-hint">正在加载预览…</p>'
          : err
            ? `<p class="gk-error">${esc(err)}</p>`
            : txt
              ? `<pre class="gk-preview-block gk-qoder-preview-pre" aria-label="文件预览">${esc(txt)}${
                  trunc ? '\n\n… 已截断' : ''
                }</pre>`
              : '<p class="gk-hint">无内容</p>';

    el.innerHTML = `
      <div class="gk-qoder-banner">
        <p class="gk-spec-banner-label">.qoder 资源</p>
        <p class="gk-hint" style="margin:0;">仅扫描<strong>当前工作区</strong>下的 <code>.qoder/</code>（<code>.md</code> / <code>.mdc</code>）。根目录 <code>AGENTS.md</code> 中的 Qoder 索引由模板维护；此处为文件级列表与预览。</p>
        <p class="gk-note" style="margin-top:8px;"><strong>记录本轮要点（剪贴板）</strong>位于下方：扩展<strong>无法读取</strong> IDE 对话面板原文，请先在对话里<strong>复制</strong>问答后再点按钮，内容会追加到 <code>.qoder/logs/gluekit-round-notes.md</code>。全量按回合留痕可依赖 Qoder 对「GlueKit 对话留痕规则」的执行（写入 <code>.qoder/logs/gluekit-session-log.md</code>）。</p>
      </div>
      <div class="gk-qoder-toolbar">
        <button type="button" class="primary sm" id="btn-qoder-rule">创建 GlueKit 对话留痕 Rule（一条）</button>
        <button type="button" class="ghost sm" id="btn-qoder-clipboard">记录本轮要点（剪贴板）</button>
      </div>
      <div class="gk-qoder-split">
        <div class="gk-qoder-col-list">${listHtml}</div>
        <div class="gk-qoder-col-preview">
          <div class="gk-qoder-preview-head">${previewHead}</div>
          ${previewBlock}
        </div>
      </div>
    `;

    document.getElementById('btn-qoder-rule')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'ensureQoderGluekitRule', payload: {} });
    });
    document.getElementById('btn-qoder-clipboard')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'appendQoderRoundNotesFromClipboard', payload: {} });
    });
    el.querySelectorAll('[data-qoder-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-qoder-open');
        if (p) {
          vscode.postMessage({ type: 'openFile', payload: p });
        }
      });
    });
    el.querySelectorAll('[data-qoder-preview]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-qoder-preview');
        if (p) {
          requestQoderFilePreview(p);
        }
      });
    });
    el.querySelectorAll('[data-qoder-reveal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-qoder-reveal');
        if (p) {
          vscode.postMessage({ type: 'revealInExplorer', payload: p });
        }
      });
    });
  }

  window.addEventListener('message', (event) => {
    const m = event.data;
    if (!m || typeof m !== 'object') {
      return;
    }
    if (m.type === 'scanResult') {
      scan = { ...emptyScan(), ...m.payload };
    }
    if (m.type === 'stateResult') {
      state = { ...defaultState(), ...m.payload };
    }
    if (m.type === 'runnableTasksResult') {
      workflowRunnable = m.payload || null;
    }
    if (m.type === 'error') {
      errMsg = String(m.payload || '错误');
    }
    if (m.type === 'filePreviewResult') {
      const pl = m.payload || {};
      const row = {
        path: String(pl.path || ''),
        text: String(pl.text || ''),
        truncated: !!pl.truncated,
        error: String(pl.error || ''),
        loading: false,
      };
      if (pl.channel === 'qoder') {
        qoderFilePreview = row;
      } else if (pl.channel === 'workflow') {
        workflowFilePreview = row;
      } else {
        filePreview = row;
      }
    }
    if (m.type === 'agentsFileTouched') {
      filePreview = { path: '', text: '', truncated: false, error: '', loading: false };
    }
    render();
  });

  vscode.postMessage({ type: 'ready' });
})();
