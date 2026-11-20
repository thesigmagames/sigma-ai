import React, { useState } from 'react';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
  onPreviewCode?: (code: string, language: string) => void;
}

function renderInline(text: string, isUser: boolean): React.ReactNode[] {
  const regex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|~~([^~]+)~~|(https?:\/\/[^\s<>"']+))/g;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(text.slice(lastIdx, match.index));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a
          key={`lnk-${keyIdx++}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 font-medium ${
            isUser
              ? 'text-blue-100 hover:text-white'
              : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
          }`}
        >
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      nodes.push(
        <strong key={`b-${keyIdx++}`} className="font-semibold">
          {match[4]}
        </strong>
      );
    } else if (match[5]) {
      nodes.push(
        <em key={`i-${keyIdx++}`} className="italic">
          {match[5]}
        </em>
      );
    } else if (match[6]) {
      nodes.push(
        <code
          key={`c-${keyIdx++}`}
          className={`px-1.5 py-0.5 rounded text-[0.85em] font-mono ${
            isUser
              ? 'bg-blue-700/70 text-white'
              : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-900 dark:text-slate-100'
          }`}
        >
          {match[6]}
        </code>
      );
    } else if (match[7]) {
      nodes.push(
        <del key={`d-${keyIdx++}`} className="line-through opacity-75">
          {match[7]}
        </del>
      );
    } else if (match[8]) {
      nodes.push(
        <a
          key={`raw-${keyIdx++}`}
          href={match[8]}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 break-all ${
            isUser
              ? 'text-blue-100 hover:text-white'
              : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
          }`}
        >
          {match[8]}
        </a>
      );
    }

    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    nodes.push(text.slice(lastIdx));
  }

  return nodes.length > 0 ? nodes : [text];
}

const CodeBlock: React.FC<{
  language: string;
  code: string;
  onPreviewCode?: (code: string, language: string) => void;
}> = ({ language, code, onPreviewCode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const canPreview =
    Boolean(onPreviewCode) &&
    ['html', 'htm', 'javascript', 'js', 'css', 'svg'].includes(language.toLowerCase());

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-slate-800/90 border-b border-slate-700/80 text-xs">
        <span className="font-mono text-slate-300">{language || 'kod'}</span>
        <div className="flex items-center gap-3">
          {canPreview && onPreviewCode && (
            <button
              type="button"
              onClick={() => onPreviewCode(code, language)}
              className="inline-flex items-center gap-1.5 text-blue-300 hover:text-blue-200 font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-play text-[10px]" />
              <span>Canlı Önizle</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className={`fa-solid ${copied ? 'fa-check text-emerald-400' : 'fa-copy'} text-[11px]`} />
            <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
          </button>
        </div>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isUser = false,
  onPreviewCode
}) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <CodeBlock
          key={`cb-${i}`}
          language={lang}
          code={codeLines.join('\n')}
          onPreviewCode={onPreviewCode}
        />
      );
      i++;
      continue;
    }

    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      lines[i + 1].includes('|') &&
      /^[\s|:-]+$/.test(lines[i + 1].trim())
    ) {
      const parseRow = (rowStr: string) =>
        rowStr
          .split('|')
          .map((c) => c.trim())
          .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));

      const headers = parseRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(parseRow(lines[i]));
        i++;
      }

      elements.push(
        <div
          key={`tbl-${i}`}
          className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                {headers.map((h, colIdx) => (
                  <th key={colIdx} className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">
                    {renderInline(h, false)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {renderInline(cell, false)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${i}`} className="text-xs font-bold uppercase tracking-wide mt-2.5 mb-1 opacity-90">
          {renderInline(line.slice(5), isUser)}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-semibold mt-3 mb-1.5">
          {renderInline(line.slice(4), isUser)}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-bold mt-3.5 mb-1.5">
          {renderInline(line.slice(3), isUser)}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-lg font-bold mt-4 mb-2">
          {renderInline(line.slice(2), isUser)}
        </h1>
      );
      i++;
      continue;
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 ml-4 list-disc space-y-1 text-sm leading-relaxed">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item, isUser)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 ml-4 list-decimal space-y-1 text-sm leading-relaxed">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item, isUser)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim().startsWith('> ')) {
      elements.push(
        <blockquote
          key={`bq-${i}`}
          className={`my-2 px-3.5 py-2 rounded-lg border text-xs sm:text-sm ${
            isUser
              ? 'border-blue-400/50 bg-blue-700/40 text-blue-50'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300'
          }`}
        >
          {renderInline(line.trim().slice(2), isUser)}
        </blockquote>
      );
      i++;
      continue;
    }

    if (line.trim() === '') {
      elements.push(<div key={`sp-${i}`} className="h-2" />);
      i++;
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="my-1 text-sm leading-relaxed">
        {renderInline(line, isUser)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5 break-words">{elements}</div>;
};
