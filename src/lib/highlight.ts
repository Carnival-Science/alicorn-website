// A deliberately small highlighter for the source drawer. It knows enough of
// Odin and JavaScript to separate keywords, strings, numbers, comments and
// procedure names, and leaves every colour to the stylesheet.
const keywords = new Set([
  'import', 'package', 'proc', 'struct', 'enum', 'union', 'if', 'else', 'for', 'in',
  'return', 'defer', 'switch', 'case', 'when', 'using', 'distinct', 'true', 'false', 'nil',
  'export', 'default', 'async', 'function', 'await', 'const', 'let', 'throw', 'new',
]);

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const token = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)(\s*(?:::|\())?/gm;

export function highlight(code: string) {
  return code.split('\n').map((line) => {
    let out = '', last = 0;
    for (const m of line.matchAll(token)) {
      out += escape(line.slice(last, m.index));
      const [all, comment, str, num, word, call] = m;
      if (comment) out += `<span class="tk-c">${escape(comment)}</span>`;
      else if (str) out += `<span class="tk-s">${escape(str)}</span>`;
      else if (num) out += `<span class="tk-n">${num}</span>`;
      else if (keywords.has(word)) out += `<span class="tk-k">${word}</span>${escape(call ?? '')}`;
      else if (call) out += `<span class="tk-f">${word}</span>${escape(call)}`;
      else out += escape(all);
      last = (m.index ?? 0) + all.length;
    }
    return `<span class="ln">${out + escape(line.slice(last))}</span>`;
  }).join('');
}
