/** 极简 YAML 头解析（单行 key: value），满足 status 等字段读写 */

export interface ParsedMd {
  hasFrontmatter: boolean;
  yamlRaw: string;
  body: string;
  fields: Record<string, string>;
}

export function parseMarkdownFrontmatter(content: string): ParsedMd {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) {
    return { hasFrontmatter: false, yamlRaw: '', body: content, fields: {} };
  }
  const yamlRaw = m[1];
  const body = m[2];
  const fields: Record<string, string> = {};
  for (const line of yamlRaw.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_.]+):\s*(.*)$/);
    if (kv) {
      let v = kv[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      fields[kv[1]] = v;
    }
  }
  return { hasFrontmatter: true, yamlRaw, body, fields };
}

export function setFrontmatterField(content: string, key: string, value: string): string {
  const p = parseMarkdownFrontmatter(content);
  const line = `${key}: ${value}`;
  if (!p.hasFrontmatter) {
    return `---\n${line}\n---\n\n${content}`;
  }
  let yaml = p.yamlRaw;
  const re = new RegExp(`^${key}:\\s*.*$`, 'm');
  if (re.test(yaml)) {
    yaml = yaml.replace(re, line);
  } else {
    yaml = yaml.trimEnd() + '\n' + line;
  }
  return `---\n${yaml}\n---\n${p.body}`;
}
