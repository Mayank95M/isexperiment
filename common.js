/* IS perception study: code shared by the participant page (index.html) and the editor (editor.html).
   Plain browser JavaScript, no build step; also loads in Node for the tests (module.exports). */
(function (root) {
  'use strict';
  const ISP = {};

  /* ------------------------------------------------------------------ small helpers */
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  ISP.esc = esc;
  ISP.clone = o => JSON.parse(JSON.stringify(o));
  ISP.uid = (n = 24) => {
    const a = 'abcdefghijkmnpqrstuvwxyz23456789';
    let s = '';
    const c = root.crypto && root.crypto.getRandomValues ? root.crypto : null;
    if (c) { const b = new Uint8Array(n); c.getRandomValues(b); b.forEach(x => { s += a[x % a.length]; }); }
    else for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  };
  ISP.slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'item';
  ISP.words = s => (String(s || '').replace(/[#*|_>\[\]()`-]/g, ' ').match(/[A-Za-z0-9À-ɏ'’]+/g) || []).length;
  ISP.shuffle = (arr, rnd = Math.random) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  ISP.median = xs => { const a = xs.filter(x => typeof x === 'number' && isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  ISP.mean = xs => { const a = xs.filter(x => typeof x === 'number' && isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  ISP.sd = xs => { const a = xs.filter(x => typeof x === 'number' && isFinite(x)); if (a.length < 2) return null; const m = ISP.mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };

  /* ------------------------------------------------------------------ text with placeholders
     {n} number of methods each person reads, {method} {phase} {position} on method pages,
     {{DE: text}} shown only to group DE (any group id; several ids: {{DP,DE: text}}). */
  ISP.fill = function (text, ctx) {
    ctx = ctx || {};
    let s = String(text == null ? '' : text);
    s = s.replace(/\{\{\s*([A-Za-z0-9_,\s]+?)\s*:([\s\S]*?)\}\}/g, (m, ids, body) => {
      const list = ids.split(',').map(x => x.trim()).filter(Boolean);
      if (!ctx.group) return ctx.allGroups ? body : '';
      return list.indexOf(ctx.group) >= 0 ? body : '';
    });
    return s.replace(/\{(\w+)\}/g, (m, k) => (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, k) ? String(ctx.vars[k]) : m));
  };

  /* ------------------------------------------------------------------ a small, safe Markdown
     Paragraphs (blank line), line breaks (single newline), **bold**, *italic*, [link](https://...),
     bare https:// links, ![image](url), lists (- or 1.), nested by two spaces, ### headings,
     tables of | cells | (a |---| row after the first row makes it a header). HTML is escaped. */
  function inline(s) {
    let t = esc(s);
    const store = [];
    const keep = h => { store.push(h); return '\u0001' + (store.length - 1) + '\u0002'; };
    t = t.replace(/!\[([^\]]*)\]\(((?:https?:\/\/|\.\/|images\/)[^\s)]+)\)/g, (m, alt, url) => keep('<img src="' + url + '" alt="' + alt + '" loading="lazy">'));
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (m, label, url) => keep('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>'));
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:])/g, (m, pre, url) => pre + keep('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>'));
    t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
    t = t.replace(/\u0001(\d+)\u0002/g, (m, i) => store[Number(i)]);
    return t;
  }
  ISP.inline = inline;

  ISP.md = function (src) {
    const lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n');
    const out = [];
    let i = 0;
    const isList = l => /^\s*([-*•]|\d+[.)])\s+/.test(l);
    const isTable = l => /^\s*\|.*\|\s*$/.test(l);
    const isHead = l => /^\s*#{1,6}\s+/.test(l);
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      if (isHead(l)) {
        const m = l.trim().match(/^(#{1,6})\s+(.*)$/);
        out.push('<h4 class="mdh">' + inline(m[2]) + '</h4>'); i++; continue;
      }
      if (isTable(l)) {
        const rows = [];
        while (i < lines.length && isTable(lines[i])) { rows.push(lines[i].trim()); i++; }
        const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        let head = null;
        if (rows.length > 1 && /^\|?\s*:?-{2,}/.test(rows[1].replace(/^\|/, '').trim())) { head = cells(rows[0]); rows.splice(0, 2); }
        let h = '<div class="tablewrap"><table class="mdt">';
        if (head) h += '<thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead>';
        h += '<tbody>' + rows.map(r => '<tr>' + cells(r).map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
        out.push(h); continue;
      }
      if (isList(l)) {
        // collect the list block, then build nested lists by indentation
        const items = [];
        while (i < lines.length && (isList(lines[i]) || (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length))) {
          const ln = lines[i];
          if (isList(ln)) {
            const m = ln.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
            items.push({ ind: m[1].length, ord: /\d/.test(m[2]), text: m[3] });
          } else items[items.length - 1].text += '<br>' + ln.trim();
          i++;
        }
        const build = (start, ind) => {
          let h = '', k = start;
          const ord = items[start].ord;
          h += ord ? '<ol>' : '<ul>';
          while (k < items.length && items[k].ind >= ind) {
            if (items[k].ind > ind) { const r = build(k, items[k].ind); h = h.replace(/<\/li>$/, '') + r.html + '</li>'; k = r.next; continue; }
            h += '<li>' + inline(items[k].text).replace(/&lt;br&gt;/g, '<br>') + '</li>'; k++;
          }
          return { html: h + (ord ? '</ol>' : '</ul>'), next: k };
        };
        let k = 0;
        while (k < items.length) { const r = build(k, items[k].ind); out.push(r.html); k = r.next; }
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !isList(lines[i]) && !isTable(lines[i]) && !isHead(lines[i])) { para.push(lines[i].trim()); i++; }
      out.push('<p>' + para.map(inline).join('<br>') + '</p>');
    }
    return out.join('\n');
  };
  ISP.mdText = src => String(src == null ? '' : src).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*#|]/g, '').replace(/^\s*[-•]\s+/gm, '').trim();

  /* ------------------------------------------------------------------ the 18 information elements */
  ISP.ELEMENTS = [
    ['objective', 'Objective', 'the purpose the method aims to achieve'],
    ['description', 'Detailed description', "the method's rationale and intended application"],
    ['steps', 'Steps', 'the sequence of actions'],
    ['input', 'Input', 'what the method works on'],
    ['output', 'Output', 'what the method produces'],
    ['concise_example', 'Concise example', 'a brief example of use'],
    ['detailed_example', 'Detailed example', 'a step-by-step application in one context'],
    ['benefits', 'Benefits', 'the advantages of using it'],
    ['limitations', 'Limitations', 'the challenges of using it'],
    ['keep_in_mind', 'Things to keep in mind', 'key considerations and precautions'],
    ['resources', 'Required resources', 'people, time, materials and budget'],
    ['phase', 'Design phase', 'the stage of the design process it suits'],
    ['domain', 'Suitable domain', 'the fields or contexts it suits'],
    ['related', 'Related methods', 'similar or combinable methods'],
    ['difficulty', 'Level of difficulty', 'the expertise or effort it takes'],
    ['skills', 'Method-specific skills', 'the skills needed to use it'],
    ['assumptions', 'Underlying assumptions', 'the beliefs the method rests on'],
    ['literature', 'Literature', 'sources for further reading']
  ].map(([id, label, hint]) => ({ id, label, hint }));

  // other headings people use for the same element (lower case, no punctuation)
  ISP.ALIASES = {
    objective: ['objective', 'objectives', 'aim', 'goal'],
    description: ['detailed description', 'description', 'overview'],
    steps: ['steps', 'procedure', 'process', 'how to', 'method steps'],
    input: ['input', 'inputs'],
    output: ['output', 'outputs', 'outcome', 'outcomes'],
    concise_example: ['concise example', 'short example', 'brief example', 'example'],
    detailed_example: ['detailed example', 'worked example', 'case example'],
    benefits: ['benefits', 'advantages', 'strengths'],
    limitations: ['limitations', 'disadvantages', 'weaknesses', 'drawbacks'],
    keep_in_mind: ['things to keep in mind', 'keep in mind', 'tips', 'considerations'],
    resources: ['required resources', 'resources', 'resources required'],
    phase: ['design phase', 'design phases', 'design stage', 'phase'],
    domain: ['suitable domain', 'suitable domains', 'domain', 'domains'],
    related: ['related methods', 'related method', 'similar methods'],
    difficulty: ['level of difficulty', 'difficulty', 'difficulty level'],
    skills: ['method specific skills', 'method specific skill', 'method specific skill s', 'method specific skills required', 'skills', 'skills required', 'required skills'],
    assumptions: ['underlying assumptions', 'assumptions'],
    literature: ['literature', 'literature bibliography', 'bibliography', 'references', 'further reading', 'sources']
  };
  // headings that belong inside an element rather than starting one
  ISP.SUBHEADS = { 'time to execute': 'resources', 'time required': 'resources', 'purpose': null };

  const normHead = s => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  /* ------------------------------------------------------------------ paste a method description, get its elements
     Splits plain text (copied from a web page, a Word file or a PDF) at the element headings.
     Lines broken by a PDF's page width are joined again; one-line entries become list items. */
  ISP.importDescription = function (text, elements) {
    elements = elements || ISP.ELEMENTS;
    const ids = elements.map(e => e.id);
    const alias = {};
    elements.forEach(e => {
      alias[normHead(e.label)] = e.id;
      (ISP.ALIASES[e.id] || []).forEach(a => { if (!alias[a]) alias[a] = e.id; });
    });
    const raw = String(text || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n').map(l => l.replace(/\s+$/, ''));
    // typical full-line length, to recognise lines a PDF wrapped
    const lens = raw.map(l => l.trim().length).filter(n => n > 0).sort((a, b) => a - b);
    const p90 = lens.length ? lens[Math.min(lens.length - 1, Math.floor(lens.length * 0.98))] : 0;
    const near = lens.filter(n => n >= p90 * 0.85).length;
    const wrapped = p90 >= 55 && p90 <= 115 && near >= 4;
    const sections = {}, extra = [];
    let name = '', cur = null, curIdx = -1;
    raw.forEach(line => {
      const t = line.trim();
      const h = normHead(t.replace(/:$/, ''));
      const isShort = t.length > 0 && t.length <= 60 && !/[.,;]$/.test(t);
      const id = isShort ? alias[h] : null;
      if (id && ids.indexOf(id) > curIdx) { cur = id; curIdx = ids.indexOf(id); sections[cur] = sections[cur] || []; return; }
      if (isShort && (h in ISP.SUBHEADS || (id && ids.indexOf(id) <= curIdx))) {
        const target = (h in ISP.SUBHEADS && ISP.SUBHEADS[h] && ids.indexOf(ISP.SUBHEADS[h]) >= 0) ? ISP.SUBHEADS[h] : cur;
        if (target) { sections[target] = sections[target] || []; sections[target].push('', '\u0003' + t.replace(/:$/, '')); return; }
      }
      if (!cur) { if (t && !name) name = t; else if (t) extra.push(t); return; }
      sections[cur].push(line);
    });
    const listy = { steps: 1, input: 1, output: 1, benefits: 1, limitations: 1, keep_in_mind: 1, resources: 1, phase: 1, domain: 1, related: 1, skills: 1, assumptions: 1, literature: 1 };
    const out = {};
    Object.keys(sections).forEach(id => {
      // logical lines: join wrapped lines; keep blank lines as breaks
      const logical = [];
      let buf = '';
      const lines = sections[id];
      lines.forEach((ln, k) => {
        const t = ln.trim();
        if (!t) { if (buf) { logical.push(buf); buf = ''; } logical.push(''); return; }
        if (t[0] === '\u0003') { if (buf) { logical.push(buf); buf = ''; } logical.push(t); return; }
        buf = buf ? (buf.endsWith('-') && /[a-z]-$/.test(buf) ? buf + t : buf + ' ' + t) : t;
        const next = (lines[k + 1] || '').trim();
        const nextIsNew = /^[-•*]\s/.test(next) || /^[A-Z][^:—–.]{1,50}:\s/.test(next) || /^Step \d+/i.test(next);
        const wraps = wrapped && t.length >= p90 * 0.8 && next && !nextIsNew && !(listy[id] && /[.?!:]$/.test(t));
        if (!wraps) { logical.push(buf); buf = ''; }
      });
      if (buf) logical.push(buf);
      const md = [];
      logical.forEach(l => {
        if (!l) { if (md.length && md[md.length - 1] !== '') md.push(''); return; }
        if (l[0] === '\u0003') { md.push('', '**' + l.slice(1) + '**'); return; }
        let s = l.replace(/^[•*]\s*/, '');
        const lab = id === 'literature' ? null : s.match(/^([A-Z][^:—–.()]{1,70}?)(\s?[:—–]|\s-\s)\s*(.*)$/);
        if (lab && lab[3] && !/^https?$/i.test(lab[1].trim()) && lab[1].trim().split(/\s+/).length <= 8) s = '**' + lab[1].trim() + (lab[2].trim() === ':' ? ':' : '') + '**' + (lab[2].trim() === ':' ? ' ' : ' ' + lab[2].trim() + ' ') + lab[3];
        md.push(listy[id] ? '- ' + s : s);
      });
      // paragraphs: separate non-list lines by blank lines; lists stay together
      const joined = [];
      md.forEach((l, k) => {
        if (l === '') {   // a blank line between two list items does not end the list
          const prev = joined[joined.length - 1] || '', next = md.slice(k + 1).find(x => x !== '') || '';
          if (!(prev.startsWith('- ') && next.startsWith('- '))) joined.push('');
          return;
        }
        const prev = joined[joined.length - 1];
        if (prev !== undefined && prev !== '' && !(l.startsWith('- ') && prev.startsWith('- '))) joined.push('');
        joined.push(l);
      });
      out[id] = joined.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    });
    return { name, elements: out, extra, wrapped };
  };

  /* ------------------------------------------------------------------ study structure */
  ISP.scale = (c, id) => (c.scales || {})[id] || { points: [] };
  ISP.shown = (thing, group) => !thing || !thing.showTo || !thing.showTo.length || (group && thing.showTo.indexOf(group) >= 0);
  ISP.groupItem = c => { for (const p of c.parts || []) for (const it of p.items || []) if (it.role === 'group') return { part: p, item: it }; return null; };
  ISP.groupOf = (c, answers) => {
    const g = ISP.groupItem(c);
    if (!g) return null;
    const v = (answers || {})[g.item.id];
    const o = (g.item.options || []).find(x => x.id === v);
    return o ? (o.group || null) : null;
  };
  ISP.methodById = (c, id) => (c.methods || []).find(m => m.id === id) || null;
  ISP.phaseLabel = (c, id) => ((c.phases || []).find(p => p.id === id) || {}).label || id || '';
  ISP.activeMethods = c => (c.methods || []).filter(m => m.on !== false);
  ISP.allItems = c => {
    const out = [];
    (c.parts || []).forEach(p => (p.items || []).forEach(it => out.push({ part: p, item: it })));
    ((c.perMethod || {}).items || []).forEach(it => out.push({ part: { id: 'B', title: 'After each method description' }, item: it, perMethod: true }));
    return out;
  };
  // the rows of a matrix item, for a participant (allocated methods) or for the codebook (all methods)
  ISP.matrixRows = (c, it, methods) => {
    let rows;
    if (it.rows === 'elements') rows = (c.elements || []).map(e => ({ id: it.id + '_' + e.id, text: '**' + e.label + '**' + (e.hint ? ': ' + e.hint : ''), el: e.id }));
    else if (it.rows === 'allocated' || it.rows === 'methods') {
      const ms = it.rows === 'allocated' && methods ? methods.map(id => ISP.methodById(c, id)).filter(Boolean) : ISP.activeMethods(c);
      rows = ms.map(m => ({ id: it.id + '_' + m.id, text: m.name, method: m.id }));
    } else rows = (Array.isArray(it.rows) ? it.rows : []).map(r => ({ id: it.id + '_' + r.id, text: r.text }));
    (it.extraRows || []).forEach(x => {
      const at = rows.findIndex(r => r.el === x.after || r.id === x.after || r.id === it.id + '_' + x.after);
      const row = { id: x.id, text: x.text, extra: true };
      if (at >= 0) rows.splice(at + 1, 0, row); else rows.push(row);
    });
    return rows;
  };
  // every variable an item produces (the codebook), with how it is coded
  ISP.itemVars = (c, it) => {
    const sc = ISP.scale(c, it.scale);
    const vals = sc.points && sc.points.length ? sc.points.map(p => p[0] + ' = ' + p[1]).join('; ') : '';
    switch (it.type) {
      case 'likert': return [{ v: it.id, text: it.text, values: vals, reverse: !!it.reverse, construct: it.construct || '' }];
      case 'matrix': return ISP.matrixRows(c, it).map(r => ({ v: r.id, text: ISP.mdText(it.text) + ' / ' + ISP.mdText(r.text), values: vals }));
      case 'single': {
        const out = [{ v: it.id, text: it.text, values: (it.options || []).map(o => o.text).join('; ') }];
        if ((it.options || []).some(o => o.other)) out.push({ v: it.id + '_other', text: it.text + ' (other, specified)', values: 'text' });
        return out;
      }
      case 'multi': return [{ v: it.id, text: it.text, values: 'any of: ' + (it.options || []).map(o => o.text).join('; ') }];
      case 'number': return [{ v: it.id, text: it.text, values: 'number' + (it.unit ? ' (' + it.unit + ')' : '') }];
      case 'text': case 'longtext': return [{ v: it.id, text: it.text, values: 'text' }];
      default: return [];
    }
  };

  /* ------------------------------------------------------------------ checks before publishing */
  ISP.validate = function (c) {
    const out = [], err = (where, msg) => out.push({ level: 'error', where, msg }), warn = (where, msg) => out.push({ level: 'warn', where, msg });
    const seen = {};
    const varName = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
    const groups = (c.groups || []).map(g => g.id);
    if (!groups.length) err('Groups', 'Add at least one group.');
    if (new Set(groups).size !== groups.length) err('Groups', 'Two groups have the same code.');
    const phases = (c.phases || []).map(p => p.id);
    const active = ISP.activeMethods(c);
    const mids = (c.methods || []).map(m => m.id);
    if (new Set(mids).size !== mids.length) err('Methods', 'Two methods have the same code.');
    const usedPhases = new Set(active.map(m => m.phase));
    const k = Number((c.allocation || {}).perPerson) || 3;
    if (usedPhases.size < k) err('Allocation', 'Each person reads ' + k + ' methods from ' + k + ' different phases, but only ' + usedPhases.size + ' phase(s) have an active method.');
    (c.methods || []).forEach(m => {
      const w = 'Method "' + (m.name || m.id) + '"';
      if (!varName.test(m.id || '')) err(w, 'Its code must start with a letter and use only letters, digits and _.');
      if (phases.indexOf(m.phase) < 0) err(w, 'It has no valid design phase.');
      if (m.on === false) return;
      const empty = (c.elements || []).filter(e => !String((m.elements || {})[e.id] || '').trim()).map(e => e.label);
      if (empty.length) warn(w, 'Empty information element' + (empty.length > 1 ? 's' : '') + ': ' + empty.join(', ') + '.');
      (m.knowledge || []).forEach(q => {
        if (!q.stem || !(q.options || []).length) err(w, q.id + ' needs a question and answer options.');
        else if (!(q.options || []).some(o => o.id === q.key)) err(w, q.id + ' has no correct answer marked.');
        if ((q.options || []).some(o => !String(o.text || '').trim())) err(w, q.id + ' has an empty answer option.');
      });
      if (!(m.knowledge || []).length) warn(w, 'It has no knowledge questions.');
    });
    const kq = active.map(m => (m.knowledge || []).map(q => q.id).join(','));
    if (new Set(kq).size > 1) warn('Methods', 'Methods have different knowledge question codes (' + [...new Set(kq)].join(' / ') + '); the per-method data are easier to compare when every method uses the same codes.');
    const gi = [];
    (c.parts || []).forEach(p => (p.items || []).forEach(it => { if (it.role === 'group') gi.push(it); }));
    if (gi.length > 1) err('Questionnaire', 'Only one question can decide the group.');
    if (gi.length === 1) (gi[0].options || []).forEach(o => { if (o.group !== '_none' && groups.indexOf(o.group) < 0) err('Question ' + gi[0].id, 'Answer "' + o.text + '" does not lead to a group.'); });
    if (!gi.length && groups.length > 1) warn('Questionnaire', 'No question decides the group: everyone joins "' + groups[0] + '" unless the link says otherwise (&g=).');
    const addVar = (v, where) => { if (seen[v]) err(where, 'The code ' + v + ' is used twice (also in ' + seen[v] + ').'); else seen[v] = where; };
    let groupPage = -1;
    (c.parts || []).forEach((p, pi) => {
      if (!(p.items || []).length && !String(p.intro || '').trim()) warn('Page "' + p.title + '"', 'It has no questions and no text.');
      (p.items || []).forEach(it => {
        const w = 'Question ' + (it.id || '?') + ' (' + p.title + ')';
        if (!varName.test(it.id || '')) err(w, 'Its code must start with a letter and use only letters, digits and _.');
        if (it.role === 'group') groupPage = pi;
        if ((it.type === 'likert' || it.type === 'matrix') && !(c.scales || {})[it.scale]) err(w, 'It has no answer scale.');
        if ((it.type === 'single' || it.type === 'multi') && (it.options || []).length < 2) err(w, 'It needs at least two answer options.');
        if (it.type === 'matrix' && it.rows === 'allocated' && (p.where !== 'before' || pi <= groupPage && groupPage >= 0)) {
          if (p.where !== 'before') warn(w, 'Rows "the methods this person reads" fit best on a page before the reading.');
          else if (pi === groupPage) err(w, 'Rows "the methods this person reads" must be on a later page than the question that decides the group.');
        }
        (it.showTo || []).forEach(g => { if (groups.indexOf(g) < 0) err(w, 'It is shown to an unknown group: ' + g + '.'); });
        if (it.type !== 'note' && it.type !== 'email') ISP.itemVars(c, it).forEach(x => addVar(x.v, w));
      });
    });
    ((c.perMethod || {}).items || []).forEach(it => {
      const w = 'Question ' + it.id + ' (after each method description)';
      if (!varName.test(it.id || '')) err(w, 'Its code must start with a letter and use only letters, digits and _.');
      if (it.type === 'matrix' || it.type === 'email') err(w, 'This kind of question cannot be asked after each method description.');
    });
    const pm = new Set(((c.perMethod || {}).items || []).map(i => i.id));
    active.forEach(m => (m.knowledge || []).forEach(q => { if (pm.has(q.id)) err('Method "' + m.name + '"', 'Knowledge question ' + q.id + ' has the same code as a question after each method description.'); }));
    const q = c.quality || {};
    const all = new Set(Object.keys(seen));
    (q.attention || []).forEach(a => { if (!all.has(a.id)) warn('Data quality', 'Instructed item ' + a.id + ' is not in the questionnaire.'); });
    (q.infrequency || []).forEach(a => { if (!all.has(a.id)) warn('Data quality', 'Must-reject item ' + a.id + ' is not in the questionnaire.'); });
    if (q.useMe && q.useMe.id && !all.has(q.useMe.id)) warn('Data quality', 'The "use my answers" item ' + q.useMe.id + ' is not in the questionnaire.');
    (q.pairs || []).forEach(pr => pr.forEach(id => { if (!all.has(id)) warn('Data quality', 'Opposite pair ' + pr.join('–') + ': ' + id + ' is not in the questionnaire.'); }));
    const texts = JSON.stringify([c.texts, c.parts, c.perMethod, c.researcher]);
    const ph = texts.match(/\[(?:your|name of|[a-z][^\]"]{3,60})\]/gi);
    if (ph) warn('Texts', 'Still to fill in: ' + [...new Set(ph)].slice(0, 6).join(', ') + '.');
    return out;
  };

  /* ------------------------------------------------------------------ allocation (the same rules as the backend) */
  ISP.metaOf = c => {
    const a = c.allocation || {};
    return {
      phases: (c.phases || []).map(p => p.id),
      methods: ISP.activeMethods(c).map(m => ({ id: m.id, phase: m.phase })),
      groups: (c.groups || []).map(g => ({ id: g.id, target: Number(g.target) || 0 })),
      k: Number(a.perPerson) || 3, order: a.order || 'balanced', hold: Number(a.holdMinutes) || 120, rnd: Number(a.randomness) || 0,
      sets: a.sets || [], w: a.weights || {}
    };
  };
  ISP.candidateSets = m => {
    const byPhase = {}, phaseOf = {};
    m.methods.forEach(x => { (byPhase[x.phase] = byPhase[x.phase] || []).push(x.id); phaseOf[x.id] = x.phase; });
    const phases = m.phases.filter(p => byPhase[p] && byPhase[p].length);
    const k = Math.min(m.k, phases.length), out = [];
    if (m.sets && m.sets.length) {
      m.sets.forEach(s => { const seen = {}; let ok = s.length === k; s.forEach(id => { const ph = phaseOf[id]; if (!ph || seen[ph]) ok = false; seen[ph] = 1; }); if (ok) out.push(s.slice()); });
      if (out.length) return out;
    }
    (function pick(start, chosen) {
      if (out.length > 20000) return;
      if (chosen.length === k) {
        (function prod(i, acc) { if (i === chosen.length) { out.push(acc.slice()); return; } byPhase[chosen[i]].forEach(id => { acc.push(id); prod(i + 1, acc); acc.pop(); }); })(0, []);
        return;
      }
      for (let i = start; i < phases.length; i++) { chosen.push(phases[i]); pick(i + 1, chosen); chosen.pop(); }
    })(0, []);
    return out;
  };
  const perms = a => a.length <= 1 ? [a.slice()] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
  const num = (v, d) => { const n = Number(v); return v !== '' && v !== null && v !== undefined && isFinite(n) ? n : d; };
  // rows: [{group, methods:[...]}] already counted (finished or recently active, same kind)
  ISP.choose = function (m, rows, group, rnd = Math.random) {
    const w = m.w || {}, wm = num(w.method, 4), wp = num(w.position, 2), wr = num(w.pair, 1), wh = num(w.phase, 0), wo = num(w.overall, 1);
    const phaseOf = {}; m.methods.forEach(x => { phaseOf[x.id] = x.phase; });
    const E = {}, EO = {}, POS = {}, PR = {}, PH = {};
    rows.forEach(x => {
      const seq = x.methods || [];
      seq.forEach(id => { EO[id] = (EO[id] || 0) + 1; });
      if (x.group !== group) return;
      seq.forEach((id, i) => {
        E[id] = (E[id] || 0) + 1; POS[id + '@' + i] = (POS[id + '@' + i] || 0) + 1; PH[phaseOf[id]] = (PH[phaseOf[id]] || 0) + 1;
        for (let j = i + 1; j < seq.length; j++) { const key = [id, seq[j]].sort().join('|'); PR[key] = (PR[key] || 0) + 1; }
      });
    });
    const cand = ISP.candidateSets(m);
    if (!cand.length) throw new Error('No method set can be formed from the active methods and phases.');
    let set;
    if (rnd() < m.rnd) set = cand[Math.floor(rnd() * cand.length)];
    else {
      let best = [], bs = Infinity;
      cand.forEach(s => {
        let sc = 0;
        s.forEach((id, i) => {
          sc += wm * (E[id] || 0) + wo * (EO[id] || 0) + wh * (PH[phaseOf[id]] || 0);
          for (let j = i + 1; j < s.length; j++) sc += wr * (PR[[id, s[j]].sort().join('|')] || 0);
        });
        if (sc < bs - 1e-9) { bs = sc; best = [s]; } else if (Math.abs(sc - bs) <= 1e-9) best.push(s);
      });
      set = best[Math.floor(rnd() * best.length)];
    }
    if (m.order === 'phase') return set.slice().sort((a, b) => m.phases.indexOf(phaseOf[a]) - m.phases.indexOf(phaseOf[b]));
    const orders = perms(set);
    if (rnd() < m.rnd || wp <= 0) return orders[Math.floor(rnd() * orders.length)];
    let bo = [], bs = Infinity;
    orders.forEach(o => { let sc = 0; o.forEach((id, i) => { sc += POS[id + '@' + i] || 0; }); if (sc < bs) { bs = sc; bo = [o]; } else if (sc === bs) bo.push(o); });
    return bo[Math.floor(rnd() * bo.length)];
  };
  // seeded random numbers, so a simulation can be repeated
  ISP.rng = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  // simulate n people per group arriving in random group order; returns their allocations
  ISP.simulate = function (c, perGroup, seed, dropout) {
    const m = ISP.metaOf(c), rnd = ISP.rng(seed || 7), rows = [], queue = [];
    (c.groups || []).forEach(g => { for (let i = 0; i < (perGroup[g.id] || 0); i++) queue.push(g.id); });
    const order = ISP.shuffle(queue, rnd);
    order.forEach(g => {
      const seq = ISP.choose(m, rows.filter(r => !r.dropped), g, rnd);
      rows.push({ group: g, methods: seq, dropped: dropout ? rnd() < dropout : false });
    });
    return rows.filter(r => !r.dropped);
  };
  // balance tables for a list of allocations [{group, methods}]
  ISP.balance = function (c, rows) {
    const ms = ISP.activeMethods(c), k = Number((c.allocation || {}).perPerson) || 3, out = {};
    const groups = (c.groups || []).map(g => g.id).concat(['all']);
    groups.forEach(g => {
      const rs = rows.filter(r => g === 'all' || r.group === g);
      const exp = {}, pos = {}, pairs = {}, ph = {};
      ms.forEach(m => { exp[m.id] = 0; pos[m.id] = Array(k).fill(0); });
      rs.forEach(r => (r.methods || []).forEach((id, i) => {
        if (!(id in exp)) { exp[id] = 0; pos[id] = Array(k).fill(0); }
        exp[id]++; if (i < k) pos[id][i]++;
        const p = (ISP.methodById(c, id) || {}).phase; ph[p] = (ph[p] || 0) + 1;
        for (let j = i + 1; j < r.methods.length; j++) { const key = [id, r.methods[j]].sort().join('|'); pairs[key] = (pairs[key] || 0) + 1; }
      }));
      const ev = Object.values(exp), pv = [].concat(...Object.values(pos));
      out[g] = { n: rs.length, exposure: exp, position: pos, pairs, phases: ph,
        spread: ev.length ? Math.max(...ev) - Math.min(...ev) : 0, posSpread: pv.length ? Math.max(...pv) - Math.min(...pv) : 0 };
    });
    return out;
  };

  /* ------------------------------------------------------------------ scoring and screening */
  const isNum = v => typeof v === 'number' && isFinite(v);
  ISP.scaleRange = (c, id) => { const p = ISP.scale(c, id).points || []; const v = p.map(x => x[0]); return v.length ? [Math.min(...v), Math.max(...v)] : [1, 7]; };
  // one finished participant (state from the backend) -> scores, knowledge, flags
  ISP.score = function (c, p) {
    const s = p.state || {}, a = s.answers || {}, q = c.quality || {}, r = { flags: [], exclude: [], scales: {}, blocks: [] };
    const items = {};
    ISP.allItems(c).forEach(x => { items[x.item.id] = x.item; });
    // scale scores: the mean of a construct's items, negative items reversed
    const byC = {};
    (c.parts || []).forEach(pt => (pt.items || []).forEach(it => {
      if (it.type !== 'likert' || !it.construct || !isNum(a[it.id])) return;
      const [lo, hi] = ISP.scaleRange(c, it.scale);
      (byC[it.construct] = byC[it.construct] || []).push(it.reverse ? lo + hi - a[it.id] : a[it.id]);
    }));
    Object.keys(byC).forEach(k => { r.scales[k] = ISP.mean(byC[k]); r.scales[k + '_n'] = byC[k].length; });
    // per method: knowledge right or wrong, the ratings, reading time
    (s.blocks || []).forEach((b, i) => {
      const m = ISP.methodById(c, b.method) || { knowledge: [] }, o = { position: i + 1, method: b.method, phase: m.phase, answers: b.answers || {}, right: 0, asked: 0 };
      (m.knowledge || []).forEach(k => {
        const v = (b.answers || {})[k.id];
        o.asked++;
        o[k.id + '_ok'] = v === undefined ? null : (v === k.key ? 1 : 0);
        if (v === k.key) o.right++;
      });
      o.read_s = b.read ? Math.round((b.read.active || 0) / 1000) : null;
      o.ask_s = b.ask ? Math.round((b.ask.active || 0) / 1000) : null;
      o.lookback_s = b.ask && b.ask.panel ? Math.round(b.ask.panel / 1000) : 0;
      r.blocks.push(o);
    });
    r.knowledge = r.blocks.reduce((t, b) => t + b.right, 0);
    r.knowledgeOf = r.blocks.reduce((t, b) => t + b.asked, 0);
    if (p.mode === 'baseline') return r;
    // screening (Meade and Craig, 2012; Curran, 2016)
    (q.attention || []).forEach(x => { if (x.id in a && Number(a[x.id]) !== Number(x.expect)) r.exclude.push(x.id + ' answered ' + a[x.id] + ', not ' + x.expect); });
    if (q.useMe && q.useMe.id && (q.useMe.exclude || []).indexOf(a[q.useMe.id]) >= 0) r.exclude.push(q.useMe.id + ': asked us not to use the answers');
    (q.infrequency || []).forEach(x => { if (num(x.flagFrom, 0) > 0 && isNum(a[x.id]) && a[x.id] >= Number(x.flagFrom)) r.flags.push(x.id + ' = ' + a[x.id]); });
    let bad = 0; const badPairs = [];
    (q.pairs || []).forEach(([x, y]) => {
      if (!isNum(a[x]) || !isNum(a[y])) return;
      const [lo, hi] = ISP.scaleRange(c, (items[x] || {}).scale || 'agree7');
      if (num(q.pairGap, 4) > 0 && Math.abs(a[x] - (lo + hi - a[y])) >= num(q.pairGap, 4)) { bad++; badPairs.push(x + '/' + y); }
    });
    r.pairsInconsistent = bad;
    if (num(q.pairFlags, 2) > 0 && bad >= num(q.pairFlags, 2)) r.flags.push('opposite pairs inconsistent: ' + badPairs.join(', '));
    if (q.longString && q.longString.part) {
      const pt = (c.parts || []).find(x => x.id === q.longString.part);
      let run = 0, best = 0, prev = null;
      ((pt && pt.items) || []).forEach(it => {
        if (it.type !== 'likert' || !isNum(a[it.id])) return;
        run = a[it.id] === prev ? run + 1 : 1; prev = a[it.id]; best = Math.max(best, run);
      });
      r.longString = best;
      if (num(q.longString.run, 8) > 0 && best >= num(q.longString.run, 8)) r.flags.push('same answer ' + best + ' times in a row in part ' + q.longString.part);
    }
    if (q.speed) {
      const slow = r.blocks.filter(b => b.read_s !== null && b.read_s < num(q.speed.readSeconds, 30));   // 0 = off
      if (slow.length) r.flags.push('read ' + slow.map(b => b.method + ' in ' + b.read_s + ' s').join(', '));
      const pt = (c.parts || []).find(x => x.id === q.speed.part), pg = (s.pages || {})[q.speed.part];
      const nItems = pt ? (pt.items || []).filter(it => ISP.shown(it, p.group) && it.type !== 'note').length : 0;
      if (pg && nItems) {
        r.secondsPerItem = Math.round(pg.active / 100 / nItems) / 10;
        if (r.secondsPerItem < num(q.speed.itemSeconds, 2)) r.flags.push('part ' + q.speed.part + ' at ' + r.secondsPerItem + ' s per item');
      }
    }
    const exAt = num(q.excludeAtFlags, 2), byFlags = exAt > 0 && r.flags.length >= exAt;   // 0 = flags never exclude
    r.excluded = r.exclude.length > 0 || byFlags;
    r.reason = r.exclude.concat(byFlags ? [r.flags.length + ' flags'] : []).join('; ');
    return r;
  };

  /* ------------------------------------------------------------------ statistics */
  // Lawshe's content validity ratio and the exact critical value (one-tailed binomial, p = .05; Ayre and Scally, 2014)
  ISP.cvr = (ne, N) => N ? (ne - N / 2) / (N / 2) : null;
  ISP.cvrCritical = function (N, alpha = 0.05) {
    if (!N) return null;
    const lnC = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
    for (let ne = Math.ceil(N / 2); ne <= N; ne++) {
      let p = 0;
      for (let x = ne; x <= N; x++) p += Math.exp(lnC(N, x) - N * Math.LN2);
      if (p <= alpha) return { ne, cvr: (ne - N / 2) / (N / 2) };
    }
    return { ne: N + 1, cvr: null };
  };
  // Cronbach's alpha for rows of complete answers (items already reversed)
  ISP.alpha = function (rows) {
    rows = rows.filter(r => r.every(isNum));
    if (rows.length < 3 || !rows[0] || rows[0].length < 2) return null;
    const k = rows[0].length, v = a => { const m = ISP.mean(a); return a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1); };
    let si = 0; for (let j = 0; j < k; j++) si += v(rows.map(r => r[j]));
    const st = v(rows.map(r => r.reduce((s, x) => s + x, 0)));
    return st > 0 ? (k / (k - 1)) * (1 - si / st) : null;
  };
  // 95% confidence interval of a mean (t distribution)
  ISP.ci95 = function (xs) {
    const a = xs.filter(isNum), n = a.length;
    if (n < 2) return null;
    const t = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
    const tv = n - 1 <= 30 ? t[n - 2] : n - 1 <= 60 ? 2.000 : n - 1 <= 120 ? 1.980 : 1.960;
    const m = ISP.mean(a), se = ISP.sd(a) / Math.sqrt(n);
    return [m - tv * se, m + tv * se];
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ISP;
  else root.ISP = ISP;
})(typeof window !== 'undefined' ? window : globalThis);
