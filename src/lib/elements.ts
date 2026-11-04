import { listNodes, listPerspectives, readNodeField, readNodeMeta, readTitle } from './store.js';

export const ROLES = ['entry', 'store', 'external', 'concern'] as const;
export type Role = (typeof ROLES)[number];

/** One element of .prisme/, with what its parent diagram says about it. */
export interface ElementInfo {
  /** perspective/child/... */
  path: string;
  /** Path of the parent element, null for a perspective */
  parent: string | null;
  id: string;
  /** The display title, or null when the element has none */
  title: string | null;
  /** Full label in the parent diagram (first line = name), null for a perspective */
  label: string | null;
  /** Second line of the label, split on commas: files, folders, or a name for external systems */
  locations: string[];
  role: Role | null;
  depth: number;
  children: string[];
}

const NODE_LABEL = /(?:^|[\s>|&(])@?([\w-]+)(?:\["([^"]*)"\]|\[([^\]"]*)\]|\(\(([^)]*)\)\)|\(([^)]*)\)|\{([^}]*)\})/g;
const CLASS_LINE = /^\s*class\s+([\w\-,\s]+?)\s+(\w+)\s*;?\s*$/;

/** Node labels and roles of a flowchart: id → { label, role }. */
export function diagramNodes(text: string): Map<string, { label: string | null; role: Role | null }> {
  const nodes = new Map<string, { label: string | null; role: Role | null }>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue;
    const cls = line.match(CLASS_LINE);
    if (cls) {
      const role = (ROLES as readonly string[]).includes(cls[2]) ? cls[2] as Role : null;
      for (const id of cls[1].split(',').map(s => s.trim()).filter(Boolean)) {
        const node = nodes.get(id) ?? { label: null, role: null };
        node.role = role;
        nodes.set(id, node);
      }
      continue;
    }
    if (/^(graph|flowchart|classDef|click |style |linkStyle|subgraph|end$)/i.test(line)) continue;
    for (const m of line.matchAll(NODE_LABEL)) {
      const label = m.slice(2).find(x => x !== undefined) ?? null;
      const node = nodes.get(m[1]) ?? { label: null, role: null };
      if (label !== null && node.label === null) node.label = label;
      nodes.set(m[1], node);
    }
  }
  return nodes;
}

/** The second line of a label, split on commas ("src/a.ts, src/b/" → two locations). */
export function labelLocations(label: string | null): string[] {
  if (!label) return [];
  const lines = label.split(/\\n|<br\s*\/?>|\n/i);
  if (lines.length < 2) return [];
  return lines[1].split(',').map(s => s.trim()).filter(Boolean);
}

/** Every element of .prisme/, perspectives first, depth first. */
export function listElements(cwd?: string): ElementInfo[] {
  const out: ElementInfo[] = [];
  const walk = (perspective: string, nodePath: string[], parentNodes: Map<string, { label: string | null; role: Role | null }> | null) => {
    const id = nodePath.length ? nodePath[nodePath.length - 1] : perspective;
    const path = [perspective, ...nodePath].join('/');
    const fromParent = parentNodes?.get(id) ?? null;
    const children = listNodes(perspective, nodePath, cwd);
    out.push({
      path,
      parent: nodePath.length ? [perspective, ...nodePath.slice(0, -1)].join('/') : null,
      id,
      title: readTitle(perspective, nodePath, cwd),
      label: fromParent?.label ?? null,
      locations: labelLocations(fromParent?.label ?? null),
      role: fromParent?.role ?? null,
      depth: nodePath.length,
      children: children.map(c => `${path}/${c}`),
    });
    const diagram = readNodeField(perspective, nodePath, 'diagram', cwd);
    const nodes = diagram ? diagramNodes(diagram) : new Map();
    for (const child of children) walk(perspective, [...nodePath, child], nodes);
  };
  for (const perspective of listPerspectives(cwd)) {
    if (readNodeMeta(perspective, [], cwd) === null && listNodes(perspective, [], cwd).length === 0
      && readNodeField(perspective, [], 'description', cwd) === null) continue;
    walk(perspective, [], null);
  }
  return out;
}
