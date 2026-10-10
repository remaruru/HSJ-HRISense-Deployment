import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Renders an assistant answer with a deliberately tiny formatting subset:
 * paragraphs, "- " and "1. " lists, **bold**, "###" sub-headings and simple
 * pipe tables.
 *
 * Everything becomes React elements holding plain strings — there is no
 * `dangerouslySetInnerHTML`, no Markdown library and no link syntax, so nothing
 * the model writes can become HTML, script or a clickable URL. Links reach the
 * user only through the server-validated `links` list.
 */

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
    )
  );
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'h'; text: string }
  | { kind: 'table'; rows: string[][] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length) blocks.push({ kind: 'table', rows: rows.slice(0, 40) });
      continue;
    }
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'h', text: heading[1] });
      i++;
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''));
      blocks.push({ kind: 'ul', items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push({ kind: 'ol', items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)]|#{1,4}|\|)\s*/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    blocks.push({ kind: 'p', lines: para });
  }
  return blocks;
}

export function AssistantText({ text, className }: { text: string; className?: string }) {
  const blocks = parse(text);
  return (
    <div className={cn('space-y-2 text-sm leading-relaxed text-foreground', className)}>
      {blocks.map((b, bi) => {
        switch (b.kind) {
          case 'h':
            return (
              <p key={bi} className="text-xs font-bold uppercase tracking-wide text-muted-foreground pt-1">
                {inline(b.text, `h${bi}`)}
              </p>
            );
          case 'ul':
            return (
              <ul key={bi} className="list-disc pl-5 space-y-1 marker:text-muted-foreground">
                {b.items.map((it, ii) => (
                  <li key={ii}>{inline(it, `u${bi}-${ii}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={bi} className="list-decimal pl-5 space-y-1 marker:text-muted-foreground">
                {b.items.map((it, ii) => (
                  <li key={ii}>{inline(it, `o${bi}-${ii}`)}</li>
                ))}
              </ol>
            );
          case 'table':
            return (
              <div key={bi} className="overflow-x-auto rounded-xl border border-border-soft">
                <table className="w-full text-xs">
                  <thead className="bg-surface-2">
                    <tr>
                      {b.rows[0].map((c, ci) => (
                        <th key={ci} scope="col" className="px-2.5 py-1.5 text-left font-semibold text-foreground whitespace-nowrap">
                          {inline(c, `th${bi}-${ci}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.slice(1).map((row, ri) => (
                      <tr key={ri} className="border-t border-border-soft">
                        {row.map((c, ci) => (
                          <td key={ci} className="px-2.5 py-1.5 text-foreground/90">
                            {inline(c, `td${bi}-${ri}-${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return (
              <p key={bi} className="whitespace-pre-line">
                {inline(b.lines.join('\n'), `p${bi}`)}
              </p>
            );
        }
      })}
    </div>
  );
}
