import * as vscode from 'vscode';
import { parseMarkdownFrontmatter } from './frontmatterUtil';
import { parseTasksMdItems, type TaskItem } from './taskContext';
import { splitOutputDir } from './workflow';

export type { TaskItem };

export interface ExampleFolderMeta {
  title: string;
  desc?: string;
}

/** Harness 工程参考布局（对照 Qoder / 文档建议；present 为当前仓库探测结果） */
export interface HarnessGuideEntry {
  id: string;
  displayPath: string;
  role: string;
  present: boolean;
  /** 可打开的文件路径；目录型条目可能为空（仅表示目录存在） */
  openPath?: string;
  depth: number;
}

/** 每个 Spec 对应的拆分目录下已扫描到的文件（tasks/design 合并列表中的子集） */
export interface SpecSplitBundle {
  specPath: string;
  krioRelPaths: string[];
  /** tasks.md 内勾选行解析结果（扫描时填充） */
  taskItems?: TaskItem[];
}

export interface ScanResult {
  proposals: string[];
  specs: string[];
  tasks: string[];
  design: string[];
  agents: string[];
  references: string[];
  ciHints: string[];
  /** 入门示例（不参与 proposals/specs 工作台分类，避免重复） */
  examples: string[];
  /** gluekit-examples/manifest.json 中的 folders 字段 */
  exampleManifest: Record<string, ExampleFolderMeta>;
  harnessGuide: HarnessGuideEntry[];
  /** Spec 相对路径 → frontmatter derived_from（Proposal 等上游路径） */
  specDerivedFrom: Record<string, string>;
  /** Spec 相对路径 → frontmatter gluekit_material 列表（YAML 多行 - 项） */
  specGluekitMaterial: Record<string, string[]>;
  /** 契约类 YAML（OpenAPI 等），glob 汇总 */
  contractFiles: string[];
  deploymentDocs: string[];
  traceabilityDocs: string[];
  changelogFiles: string[];
  /** Spec 与 krio-* 拆分产物串联 */
  specSplitBundles: SpecSplitBundle[];
  /** 当前工作区内的 Qoder 项目资源（仅扫描 .qoder/ 下文本类文件） */
  qoderFiles: string[];
}

function emptyScan(): ScanResult {
  return {
    proposals: [],
    specs: [],
    tasks: [],
    design: [],
    agents: [],
    references: [],
    ciHints: [],
    examples: [],
    exampleManifest: {},
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

async function probeHarnessGuide(folder: vscode.WorkspaceFolder): Promise<HarnessGuideEntry[]> {
  const root = folder.uri;
  const exclude = '**/{node_modules,.git}/**';

  async function isFile(rel: string): Promise<boolean> {
    try {
      const st = await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, ...rel.split('/')));
      return (st.type & vscode.FileType.File) !== 0;
    } catch {
      return false;
    }
  }

  async function isDir(rel: string): Promise<boolean> {
    try {
      const st = await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, ...rel.split('/')));
      return (st.type & vscode.FileType.Directory) !== 0;
    } catch {
      return false;
    }
  }

  async function firstMatch(glob: string): Promise<string | undefined> {
    const uris = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, glob), exclude, 5);
    if (!uris.length) {
      return undefined;
    }
    return vscode.workspace.asRelativePath(uris[0]).replace(/\\/g, '/');
  }

  async function firstUnderDir(dir: string): Promise<string | undefined> {
    return firstMatch(`${dir.replace(/\/$/, '')}/**/*`);
  }

  const entries: HarnessGuideEntry[] = [];

  const agentsPath =
    (await isFile('AGENTS.md')) ? 'AGENTS.md' : (await firstMatch('**/AGENTS.md'));
  entries.push({
    id: 'agents',
    displayPath: 'AGENTS.md',
    role: '导航地图（~100 行）：索引与指路，细节在 docs/ 按需加载',
    present: !!agentsPath,
    openPath: agentsPath,
    depth: 0,
  });

  const docPairs: { id: string; rel: string; role: string }[] = [
    { id: 'doc-arch', rel: 'docs/ARCHITECTURE.md', role: '架构、层级、依赖规则' },
    { id: 'doc-dev', rel: 'docs/DEVELOPMENT.md', role: '构建 / 测试 / lint 命令' },
    { id: 'doc-sense', rel: 'docs/PRODUCT_SENSE.md', role: '业务上下文' },
  ];
  for (const d of docPairs) {
    const ok = await isFile(d.rel);
    entries.push({
      id: d.id,
      displayPath: d.rel,
      role: d.role,
      present: ok,
      openPath: ok ? d.rel : undefined,
      depth: 1,
    });
  }

  const designDir = await isDir('docs/design-docs');
  entries.push({
    id: 'design-docs',
    displayPath: 'docs/design-docs/',
    role: '组件设计文档',
    present: designDir,
    openPath: designDir ? (await firstUnderDir('docs/design-docs')) : undefined,
    depth: 1,
  });

  const execDir = await isDir('docs/exec-plans');
  entries.push({
    id: 'exec-plans',
    displayPath: 'docs/exec-plans/',
    role: '执行计划（active / completed）',
    present: execDir,
    openPath: execDir ? (await firstUnderDir('docs/exec-plans')) : undefined,
    depth: 1,
  });

  const lintDeps = await firstMatch('scripts/lint-deps.*');
  entries.push({
    id: 'lint-deps',
    displayPath: 'scripts/lint-deps.*',
    role: '层级依赖检查（示例命名，以仓库为准）',
    present: !!lintDeps,
    openPath: lintDeps,
    depth: 1,
  });

  const lintQual = await firstMatch('scripts/lint-quality.*');
  entries.push({
    id: 'lint-quality',
    displayPath: 'scripts/lint-quality.*',
    role: '代码质量规则',
    present: !!lintQual,
    openPath: lintQual,
    depth: 1,
  });

  const verifyDir = await isDir('scripts/verify');
  entries.push({
    id: 'verify',
    displayPath: 'scripts/verify/',
    role: '端到端功能验证',
    present: verifyDir,
    openPath: verifyDir ? (await firstUnderDir('scripts/verify')) : undefined,
    depth: 1,
  });

  const validatePy = (await isFile('scripts/validate.py')) ? 'scripts/validate.py' : await firstMatch('scripts/validate.py');
  entries.push({
    id: 'validate',
    displayPath: 'scripts/validate.py',
    role: '统一验证管道（示例入口）',
    present: !!validatePy,
    openPath: validatePy,
    depth: 1,
  });

  for (const [id, rel, role] of [
    ['h-tasks', 'harness/tasks', '任务状态与检查点'],
    ['h-trace', 'harness/trace', '执行轨迹与失败记录'],
    ['h-memory', 'harness/memory', '经验教训存储'],
  ] as const) {
    const dirOk = await isDir(rel);
    entries.push({
      id,
      displayPath: `${rel}/`,
      role,
      present: dirOk,
      openPath: dirOk ? (await firstUnderDir(rel)) : undefined,
      depth: 1,
    });
  }

  return entries;
}

/** 示例库路径不参与「正式」Proposal/Spec 扫描，避免与 *proposal* 等 glob 重复 */
function stripGluekitExamples(paths: string[]): string[] {
  return paths.filter((p) => !p.startsWith('gluekit-examples/') && !p.includes('/gluekit-examples/'));
}

async function readExampleManifest(
  folder: vscode.WorkspaceFolder
): Promise<Record<string, ExampleFolderMeta>> {
  const file = vscode.Uri.joinPath(folder.uri, 'gluekit-examples', 'manifest.json');
  try {
    const buf = await vscode.workspace.fs.readFile(file);
    const j = JSON.parse(Buffer.from(buf).toString('utf8')) as {
      folders?: Record<string, ExampleFolderMeta>;
    };
    return j.folders && typeof j.folders === 'object' ? j.folders : {};
  } catch {
    return {};
  }
}

/**
 * 从 Spec 的 YAML frontmatter 解析 gluekit_material 列表（多行 `- path` 或 `[]`）。
 */
function parseGluekitMaterialFromYaml(yamlRaw: string): string[] {
  const lines = yamlRaw.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^gluekit_material:\s*\[\s*\]\s*$/.test(trimmed)) {
      continue;
    }
    const oneLine = line.match(/^gluekit_material:\s*(.+)$/);
    if (oneLine && oneLine[1].trim() !== '') {
      const rest = oneLine[1].trim();
      if (rest === '[]') {
        continue;
      }
      const q = rest.match(/^["'](.+)["']\s*$/);
      if (q) {
        out.push(q[1]);
      }
      continue;
    }
    if (/^gluekit_material:\s*$/.test(line)) {
      i++;
      while (i < lines.length) {
        const L = lines[i];
        const item = L.match(/^\s*-\s+(.+)$/);
        if (item) {
          let v = item[1].trim();
          v = v.replace(/^["']|["']$/g, '');
          out.push(v);
          i++;
          continue;
        }
        if (L.trim() === '') {
          i++;
          continue;
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*:/.test(L.trim())) {
          break;
        }
        i++;
      }
    }
  }
  return out;
}

async function readSpecScanExtensions(
  folder: vscode.WorkspaceFolder,
  specRel: string
): Promise<{ derivedFrom?: string; gluekitMaterial: string[] }> {
  const uri = vscode.Uri.joinPath(folder.uri, ...specRel.split('/').filter(Boolean));
  try {
    const buf = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(buf).toString('utf8');
    const p = parseMarkdownFrontmatter(text);
    const derivedFrom = p.fields['derived_from']?.trim() || undefined;
    const gluekitMaterial = parseGluekitMaterialFromYaml(p.yamlRaw);
    return { derivedFrom, gluekitMaterial };
  } catch {
    return { derivedFrom: undefined, gluekitMaterial: [] };
  }
}

function buildSpecSplitBundles(specs: string[], tasks: string[], design: string[]): SpecSplitBundle[] {
  const files = [...tasks, ...design];
  return specs.map((specPath) => {
    const dir = splitOutputDir(specPath.replace(/\\/g, '/'));
    const prefix = `${dir}/`;
    const krioRelPaths = files
      .filter((f) => {
        const n = f.replace(/\\/g, '/');
        return n === dir || n.startsWith(prefix);
      })
      .sort();
    return { specPath, krioRelPaths, taskItems: [] };
  });
}

async function enrichSpecSplitBundlesWithTaskItems(
  folder: vscode.WorkspaceFolder,
  bundles: SpecSplitBundle[]
): Promise<SpecSplitBundle[]> {
  return Promise.all(
    bundles.map(async (b) => {
      const tasksRel = b.krioRelPaths.find((p) => {
        const n = p.replace(/\\/g, '/');
        return n.endsWith('/tasks.md') || n.split('/').pop() === 'tasks.md';
      });
      if (!tasksRel) {
        return { ...b, taskItems: [] };
      }
      try {
        const uri = vscode.Uri.joinPath(folder.uri, ...tasksRel.split('/').filter(Boolean));
        const buf = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(buf).toString('utf8');
        return { ...b, taskItems: parseTasksMdItems(text) };
      } catch {
        return { ...b, taskItems: [] };
      }
    })
  );
}

async function collect(
  folder: vscode.WorkspaceFolder,
  globs: string[],
  exclude = '**/{node_modules,.git}/**'
): Promise<string[]> {
  const set = new Set<string>();
  for (const g of globs) {
    const pattern = new vscode.RelativePattern(folder, g);
    const uris = await vscode.workspace.findFiles(pattern, exclude, 300);
    for (const u of uris) {
      const rel = vscode.workspace.asRelativePath(u);
      if (!rel.includes('node_modules')) {
        set.add(rel.replace(/\\/g, '/'));
      }
    }
  }
  return [...set].sort();
}

export async function scanWorkspace(): Promise<ScanResult> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return emptyScan();
  }

  const [
    proposalsRaw,
    specsRaw,
    tasks,
    design,
    agents,
    references,
    ciHints,
    examples,
    exampleManifest,
    harnessGuide,
    qoderFiles,
    contractRaw,
    deploymentRaw,
    traceabilityRaw,
    changelogRaw,
  ] = await Promise.all([
    collect(folder, ['**/proposals/**/*.md', '**/*proposal*.md']),
    collect(folder, ['**/specs/**/*.md', '**/*-spec.md', '**/SPEC.md', '**/Spec.md', '**/docs/**/*spec*.md']),
    collect(folder, ['**/tasks/**/*.md', '**/krio-*/**/*.md']),
    collect(folder, ['**/design/**/*.md']),
    collect(folder, ['**/AGENTS.md', '**/agents.md']),
    collect(folder, ['**/reference/**/*.md', '**/references/**/*.md']),
    collect(folder, [
      '**/.github/workflows/*.{yml,yaml}',
      '**/.gitlab-ci.yml',
      '**/Jenkinsfile',
      '**/azure-pipelines.yml',
    ]),
    collect(folder, ['gluekit-examples/**/*.md']),
    readExampleManifest(folder),
    probeHarnessGuide(folder),
    collect(folder, ['**/.qoder/**/*.md', '**/.qoder/**/*.mdc']),
    collect(folder, ['**/contracts/**/*.{yaml,yml}', '**/*openapi*.{yaml,yml}']),
    collect(folder, ['**/deployment/**/*.md', '**/DEPLOYMENT.md']),
    collect(folder, ['**/traceability/**/*.md']),
    collect(folder, [
      'CHANGELOG.md',
      'CHANGES.md',
      'docs/**/CHANGELOG.md',
      'docs/**/CHANGES.md',
    ]),
  ]);

  const proposals = stripGluekitExamples(proposalsRaw);
  const specs = stripGluekitExamples(specsRaw);

  const specExtEntries = await Promise.all(
    specs.map(async (s) => {
      const ext = await readSpecScanExtensions(folder, s);
      return [s, ext] as const;
    })
  );
  const specDerivedFrom: Record<string, string> = {};
  const specGluekitMaterial: Record<string, string[]> = {};
  for (const [k, ext] of specExtEntries) {
    if (ext.derivedFrom) {
      specDerivedFrom[k] = ext.derivedFrom;
    }
    if (ext.gluekitMaterial.length > 0) {
      specGluekitMaterial[k] = ext.gluekitMaterial;
    }
  }

  const contractFiles = stripGluekitExamples(contractRaw);
  const deploymentDocs = stripGluekitExamples(deploymentRaw);
  const traceabilityDocs = stripGluekitExamples(traceabilityRaw);
  const changelogFiles = stripGluekitExamples(changelogRaw);

  const specSplitBundles = await enrichSpecSplitBundlesWithTaskItems(
    folder,
    buildSpecSplitBundles(specs, tasks, design)
  );

  return {
    proposals,
    specs,
    tasks,
    design,
    agents,
    references,
    ciHints,
    examples,
    exampleManifest,
    harnessGuide,
    specDerivedFrom,
    specGluekitMaterial,
    contractFiles,
    deploymentDocs,
    traceabilityDocs,
    changelogFiles,
    specSplitBundles,
    qoderFiles,
  };
}
