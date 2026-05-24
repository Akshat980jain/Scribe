// ═══════════════════════════════════════════════════════════════════
// Rich Text Editor Utilities — Markdown ↔ HTML + ContentEditable Helpers
// ═══════════════════════════════════════════════════════════════════

// ── Markdown → HTML ──

export function markdownToHtml(md: string): string {
  if (!md) return '<div><br></div>';
  let html = '';
  const lines = md.split('\n');
  let i = 0;
  let inCode = false;
  let codeBuf = '';
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => { if (listType) { html += `</${listType}>`; listType = null; } };

  while (i < lines.length) {
    const line = lines[i];
    // Code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCode) { html += `<pre><code>${esc(codeBuf.trimEnd())}</code></pre>`; codeBuf = ''; inCode = false; }
      else { closeList(); inCode = true; }
      i++; continue;
    }
    if (inCode) { codeBuf += (codeBuf ? '\n' : '') + line; i++; continue; }
    // Empty line
    if (!line.trim()) { closeList(); html += '<div><br></div>'; i++; continue; }
    // HR
    if (/^[-*_]{3,}\s*$/.test(line.trim())) { closeList(); html += '<hr>'; i++; continue; }
    // Headings
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) { closeList(); html += `<h${hm[1].length}>${inl(hm[2])}</h${hm[1].length}>`; i++; continue; }
    // Blockquote
    if (line.startsWith('> ')) { closeList(); html += `<blockquote>${inl(line.slice(2))}</blockquote>`; i++; continue; }
    // Checklist
    const cm = line.match(/^[-*+]\s+\[([ xX])\]\s+(.+)$/);
    if (cm) {
      if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
      html += `<li><input type="checkbox" ${cm[1] !== ' ' ? 'checked' : ''} disabled> ${inl(cm[2])}</li>`;
      i++; continue;
    }
    // UL
    const um = line.match(/^[-*+]\s+(.+)$/);
    if (um) {
      if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
      html += `<li>${inl(um[1])}</li>`; i++; continue;
    }
    // OL
    const om = line.match(/^\d+\.\s+(.+)$/);
    if (om) {
      if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
      html += `<li>${inl(om[1])}</li>`; i++; continue;
    }
    // Raw HTML pass-through
    if (line.trimStart().startsWith('<')) { closeList(); html += line; i++; continue; }
    // Paragraph
    closeList();
    html += `<div>${inl(line)}</div>`;
    i++;
  }
  closeList();
  if (inCode) html += `<pre><code>${esc(codeBuf)}</code></pre>`;
  return html || '<div><br></div>';
}

function esc(t: string) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function inl(t: string): string {
  if (t.trim().startsWith('<') && t.trim().endsWith('>')) return t;
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;">');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  t = t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');
  t = t.replace(/~~(.+?)~~/g, '<s>$1</s>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  return t;
}

// ── HTML → Markdown (DOM Walker) ──

export function htmlToMarkdown(container: HTMLElement): string {
  return walkKids(container).replace(/\n{3,}/g, '\n\n').trim();
}

function walkKids(node: Node): string {
  let r = '';
  for (const c of Array.from(node.childNodes)) r += n2md(c);
  return r;
}

function n2md(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const ch = walkKids(el);
  switch (tag) {
    case 'b': case 'strong': return `**${ch}**`;
    case 'i': case 'em': return `*${ch}*`;
    case 's': case 'strike': case 'del': return `~~${ch}~~`;
    case 'u': return `<u>${ch}</u>`;
    case 'sub': return `<sub>${ch}</sub>`;
    case 'sup': return `<sup>${ch}</sup>`;
    case 'h1': return `\n# ${ch}\n`;
    case 'h2': return `\n## ${ch}\n`;
    case 'h3': return `\n### ${ch}\n`;
    case 'h4': return `\n#### ${ch}\n`;
    case 'h5': return `\n##### ${ch}\n`;
    case 'h6': return `\n###### ${ch}\n`;
    case 'br': return '\n';
    case 'hr': return '\n---\n';
    case 'blockquote':
      return '\n' + ch.split('\n').filter(l => l.trim()).map(l => `> ${l.trim()}`).join('\n') + '\n';
    case 'ul':
      return '\n' + Array.from(el.children).map(li => `- ${walkKids(li).trim()}`).join('\n') + '\n';
    case 'ol':
      return '\n' + Array.from(el.children).map((li, i) => `${i + 1}. ${walkKids(li).trim()}`).join('\n') + '\n';
    case 'li': return ch;
    case 'a': return `[${ch}](${el.getAttribute('href') || ''})`;
    case 'img': return `![${el.getAttribute('alt') || ''}](${el.getAttribute('src') || ''})`;
    case 'pre': {
      const code = el.querySelector('code');
      return `\n\`\`\`\n${(code || el).textContent || ''}\n\`\`\`\n`;
    }
    case 'code':
      return el.parentElement?.tagName.toLowerCase() === 'pre' ? (el.textContent || '') : `\`${ch}\``;
    case 'div': case 'p': {
      const c = ch.trim();
      if (!c) return '\n';
      const style = el.getAttribute('style');
      const align = el.getAttribute('align');
      if (style || align) {
        const a: string[] = [];
        if (style) a.push(`style="${style}"`);
        if (align) a.push(`align="${align}"`);
        return `\n<div ${a.join(' ')}>${c}</div>\n`;
      }
      return `\n${c}\n`;
    }
    case 'span': case 'font': case 'mark': {
      if (el.getAttribute('style') || el.getAttribute('class') || el.getAttribute('color') || el.getAttribute('size') || el.getAttribute('face')) {
        const attrs = Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' ');
        return `<${tag} ${attrs}>${ch}</${tag}>`;
      }
      return ch;
    }
    case 'input': return '';
    case 'iframe': case 'video': case 'audio': case 'table':
    case 'thead': case 'tbody': case 'tr': case 'td': case 'th':
      return el.outerHTML;
    default: {
      if (el.attributes.length > 0) {
        const attrs = Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' ');
        return `<${tag} ${attrs}>${ch}</${tag}>`;
      }
      return ch;
    }
  }
}

// ── Textarea Compatibility Shim ──
// Adds .value, .selectionStart, .selectionEnd, .setSelectionRange, .select
// to a contentEditable div so legacy handlers don't crash.

export function setupEditorCompat(el: HTMLDivElement) {
  const getOff = (container: Node, tgt: Node, tgtOff: number): number => {
    const r = document.createRange();
    r.selectNodeContents(container);
    r.setEnd(tgt, tgtOff);
    return r.toString().length;
  };

  if (!Object.getOwnPropertyDescriptor(el, 'value')) {
    Object.defineProperty(el, 'value', {
      get() { return this.innerText || ''; },
      set(v: string) { this.innerHTML = markdownToHtml(v); },
      configurable: true,
    });
  }
  if (!Object.getOwnPropertyDescriptor(el, 'selectionStart')) {
    Object.defineProperty(el, 'selectionStart', {
      get() {
        const s = window.getSelection();
        if (!s || s.rangeCount === 0 || !this.contains(s.anchorNode)) return 0;
        return getOff(this, s.getRangeAt(0).startContainer, s.getRangeAt(0).startOffset);
      },
      configurable: true,
    });
  }
  if (!Object.getOwnPropertyDescriptor(el, 'selectionEnd')) {
    Object.defineProperty(el, 'selectionEnd', {
      get() {
        const s = window.getSelection();
        if (!s || s.rangeCount === 0 || !this.contains(s.focusNode)) return 0;
        return getOff(this, s.getRangeAt(0).endContainer, s.getRangeAt(0).endOffset);
      },
      configurable: true,
    });
  }
  if (!(el as any).setSelectionRange) {
    (el as any).setSelectionRange = function(start: number, end: number) {
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      let cc = 0, sf = false;
      const walk = (n: Node): boolean => {
        if (n.nodeType === Node.TEXT_NODE) {
          const len = (n.textContent || '').length;
          if (!sf && cc + len >= start) { range.setStart(n, start - cc); sf = true; }
          if (sf && cc + len >= end) { range.setEnd(n, end - cc); return true; }
          cc += len;
        } else { for (const c of Array.from(n.childNodes)) { if (walk(c)) return true; } }
        return false;
      };
      if (walk(this)) { sel.removeAllRanges(); sel.addRange(range); }
    };
  }
  if (!(el as any).select) {
    (el as any).select = function() {
      const s = window.getSelection();
      if (s) { const r = document.createRange(); r.selectNodeContents(this); s.removeAllRanges(); s.addRange(r); }
    };
  }
}

// ── Selection Save / Restore ──

let _savedRange: Range | null = null;

export function saveSelection() {
  const s = window.getSelection();
  if (s && s.rangeCount > 0) _savedRange = s.getRangeAt(0).cloneRange();
}

export function restoreSelection(editor?: HTMLElement) {
  if (editor) editor.focus();
  const s = window.getSelection();
  if (s && _savedRange) { s.removeAllRanges(); s.addRange(_savedRange); }
}

// ── Format Command Helpers ──

export function execFormat(editor: HTMLElement, command: string, value?: string) {
  restoreSelection(editor);
  document.execCommand(command, false, value || '');
}

export function applyFontSizeToSelection(editor: HTMLElement, sizePx: string) {
  restoreSelection(editor);
  // Use fontSize=7 as temp marker, then replace <font> with <span>
  document.execCommand('fontSize', false, '7');
  const fonts = editor.querySelectorAll('font[size="7"]');
  fonts.forEach(f => {
    const span = document.createElement('span');
    span.style.fontSize = sizePx;
    span.innerHTML = f.innerHTML;
    f.replaceWith(span);
  });
}

export function insertHtmlAtCursor(editor: HTMLElement, html: string) {
  restoreSelection(editor);
  document.execCommand('insertHTML', false, html);
}
