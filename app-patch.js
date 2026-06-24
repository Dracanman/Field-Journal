/* Field Journal public patch — campaign navigation + SYS-003 survival editor.
   Loaded by sw.js after the generated app shell. Safe to remove after the next
   full public deploy copies the rebuilt private kit/index.html. */
(() => {
  'use strict';
  const PATCH_VERSION = '2026-06-23.1';
  if (window.__vfjPatchVersion === PATCH_VERSION) return;
  window.__vfjPatchVersion = PATCH_VERSION;

  const style = document.createElement('style');
  style.textContent = `
    .survival-panel{margin-top:16px;padding:18px;border:1.5px solid var(--gold-soft);border-radius:12px;background:var(--paper-card);box-shadow:0 10px 24px -22px rgba(var(--shadow)/.45)}
    .survival-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}.survival-title h3{font-size:25px}
    .survival-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:14px}
    .survival-gauge{padding:12px;border:1px solid #e7dcc4;border-radius:10px;background:#fffaf0}.survival-gauge-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.survival-gauge-head span{display:flex;align-items:center;gap:4px;color:var(--hint)}
    .survival-number{width:64px;border:1px solid var(--gold-soft);border-radius:7px;background:#fffdf7;color:var(--ink);font:inherit;padding:4px 6px;text-align:right}
    .survival-track{height:9px;overflow:hidden;border-radius:999px;background:var(--paper-slot);border:1px solid #e7dcc4}.survival-fill{height:100%;width:0;background:linear-gradient(90deg,var(--gold),var(--green));transition:width .15s ease}
    .survival-nudges{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.survival-nudges .toolbtn{flex:1 1 38px;padding:4px 7px}
    .survival-condition-editor{margin-top:16px}.survival-condition-editor>label{display:block;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:7px}
    .survival-conditions{display:flex;flex-wrap:wrap;gap:8px;min-height:34px;align-items:center}.condition-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 9px 6px 11px;border:1px solid var(--gold-soft);border-radius:999px;background:#fff8}.condition-chip button{border:0;background:transparent;color:#a85c45;font-size:18px;line-height:1;padding:0}
    .survival-add{display:flex;gap:8px;margin-top:10px}.survival-add input{flex:1 1 240px;min-width:0;border:1px solid var(--gold-soft);border-radius:8px;background:#fffdf7;color:var(--ink);font:inherit;padding:8px 10px}.survival-status{margin-top:8px}
    @media(max-width:620px){.survival-panel{padding:14px}.survival-grid{grid-template-columns:1fr}.survival-add{flex-direction:column}}
  `;
  document.head.append(style);

  const GAUGES = [
    ['health','Health'],
    ['nourishment','Nourishment'],
    ['hydration','Hydration'],
    ['rest','Rest'],
    ['temperature','Temperature Stability'],
  ];

  const cleanCondition = value => String(value || '').replace(/[\r\n|]+/g, ' ').trim().slice(0, 80);
  const parseNumber = (raw, fallback = 100) => {
    const nums = String(raw || '').match(/-?\d+(?:\.\d+)?/g) || [];
    const max = nums.length > 1 && Number(nums[1]) > 0 ? Math.round(Number(nums[1])) : 100;
    let current = nums.length ? Math.round(Number(nums[0])) : fallback;
    if (!Number.isFinite(current)) current = fallback;
    return { current: Math.max(0, Math.min(max, current)), max };
  };
  const sectionBounds = text => {
    const lines = String(text || '').split('\n');
    const start = lines.findIndex(line => /^##\s+(?:MORTAL\s+)?SURVIVAL(?:\s+STATE)?\b/i.test(line.trim()));
    if (start < 0) return { lines, start: -1, end: -1 };
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      const s = lines[i].trim();
      if (/^##\s+/.test(s) || /^---\s*$/.test(s)) { end = i; break; }
    }
    return { lines, start, end };
  };
  const parseSurvival = text => {
    const bounds = sectionBounds(text);
    const state = { present: bounds.start >= 0, conditions: [] };
    GAUGES.forEach(([key]) => { state[key] = { current: 100, max: 100 }; });
    if (bounds.start < 0) return state;
    const body = bounds.lines.slice(bounds.start + 1, bounds.end).join('\n');
    GAUGES.forEach(([key,label]) => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = new RegExp('^[\\-\\s]*' + escaped + ':\\s*(.+)$', 'mi').exec(body);
      if (match) state[key] = parseNumber(match[1]);
    });
    let inConditions = false;
    body.split('\n').forEach(line => {
      if (/^Conditions:\s*$/i.test(line.trim())) { inConditions = true; return; }
      if (!inConditions) return;
      const match = /^[-*]\s+(.+)$/.exec(line.trim());
      if (match && !/^none\.?$/i.test(match[1].trim())) state.conditions.push(cleanCondition(match[1]));
    });
    state.conditions = [...new Set(state.conditions.filter(Boolean))];
    return state;
  };
  const formatSurvival = state => {
    const lines = ['## MORTAL SURVIVAL STATE','', '(Reserves 0–100; higher is better. Specific wounds and hazards are named conditions.)'];
    GAUGES.forEach(([key,label]) => {
      const gauge = state[key] || { current: 100, max: 100 };
      const max = Number(gauge.max) > 0 ? Math.round(Number(gauge.max)) : 100;
      const current = Math.max(0, Math.min(max, Math.round(Number(gauge.current) || 0)));
      lines.push(`- ${label}: ${current} / ${max}`);
    });
    lines.push('', 'Conditions:');
    const conditions = (state.conditions || []).map(cleanCondition).filter(Boolean);
    if (conditions.length) conditions.forEach(item => lines.push('- ' + item));
    else lines.push('- None');
    return lines.join('\n');
  };
  const updateSurvival = (text, state) => {
    if (!/Campaign State Tracker/i.test(text) || !/Personal Mana/i.test(text)) throw new Error('refusing to write — that file is not the campaign state tracker');
    const replacement = formatSurvival(state).split('\n');
    const existing = sectionBounds(text);
    if (existing.start >= 0) return [...existing.lines.slice(0, existing.start), ...replacement, ...existing.lines.slice(existing.end)].join('\n');
    const lines = String(text).split('\n');
    const runtimeStart = lines.findIndex(line => /^##\s+.*RUNTIME STATE\b/i.test(line.trim()));
    if (runtimeStart >= 0) {
      let end = lines.length;
      for (let i = runtimeStart + 1; i < lines.length; i++) {
        if (/^##\s+/.test(lines[i].trim()) || /^---\s*$/.test(lines[i].trim())) { end = i; break; }
      }
      return [...lines.slice(0, end), '', ...replacement, '', ...lines.slice(end)].join('\n');
    }
    return String(text).replace(/\s*$/, '') + '\n\n---\n\n' + replacement.join('\n') + '\n';
  };

  const makeEditor = (cfg, trackerPath, trackerText, host, campaignName) => {
    const state = parseSurvival(trackerText);
    const values = {};
    let conditions = state.conditions.slice();
    const status = h('div', { class:'hint survival-status' });
    const grid = h('div', { class:'survival-grid' });

    GAUGES.forEach(([key,label]) => {
      const gauge = state[key];
      const input = h('input', { class:'survival-number', type:'number', min:'0', max:String(gauge.max), value:String(gauge.current), inputmode:'numeric', 'aria-label':label });
      const fill = h('div', { class:'survival-fill' });
      const track = h('div', { class:'survival-track', role:'meter', 'aria-label':label, 'aria-valuemin':'0', 'aria-valuemax':String(gauge.max) }, fill);
      const paint = () => {
        let value = Math.round(Number(input.value));
        if (!Number.isFinite(value)) value = 0;
        value = Math.max(0, Math.min(gauge.max, value));
        input.value = String(value);
        fill.style.width = (value / gauge.max * 100) + '%';
        track.setAttribute('aria-valuenow', String(value));
      };
      const nudge = amount => { input.value = String(Number(input.value || 0) + amount); paint(); };
      input.oninput = paint; input.onchange = paint; paint();
      values[key] = { input, max:gauge.max };
      grid.append(h('div', { class:'survival-gauge' },
        h('div', { class:'survival-gauge-head' }, h('b', null, label), h('span', null, input, ' / ' + gauge.max)),
        track,
        h('div', { class:'survival-nudges' },
          h('button', { class:'toolbtn', type:'button', onclick:() => nudge(-5) }, '−5'),
          h('button', { class:'toolbtn', type:'button', onclick:() => nudge(-1) }, '−1'),
          h('button', { class:'toolbtn', type:'button', onclick:() => nudge(1) }, '+1'),
          h('button', { class:'toolbtn', type:'button', onclick:() => nudge(5) }, '+5'))));
    });

    const list = h('div', { class:'survival-conditions' });
    const conditionInput = h('input', { placeholder:'Add a condition — Bleeding, Freezing, Poisoned…', maxlength:'80' });
    const redraw = () => {
      list.replaceChildren();
      if (!conditions.length) { list.append(h('span', { class:'hint' }, 'No named conditions.')); return; }
      conditions.forEach((name,index) => list.append(h('span', { class:'condition-chip' }, name,
        h('button', { type:'button', 'aria-label':'Remove ' + name, onclick:() => { conditions.splice(index,1); redraw(); } }, '×'))));
    };
    const addCondition = () => {
      const clean = cleanCondition(conditionInput.value);
      if (!clean) return;
      if (!conditions.some(item => item.toLowerCase() === clean.toLowerCase())) conditions.push(clean);
      conditionInput.value = ''; redraw();
    };
    conditionInput.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); addCondition(); } };
    redraw();

    const saveButton = h('button', { class:'navbtn primary', type:'button' }, 'Save survival state');
    saveButton.onclick = async () => {
      saveButton.disabled = true;
      status.textContent = 'Saving to the campaign tracker…';
      const next = { conditions };
      GAUGES.forEach(([key]) => { next[key] = { current:Number(values[key].input.value), max:values[key].max }; });
      try {
        await ghUpdate(cfg, trackerPath, text => updateSurvival(text, next), 'Update survival state via Game', { guard:text => {
          if (!/Campaign State Tracker/i.test(text) || !/Personal Mana/i.test(text)) throw new Error('refusing to write — wrong tracker file');
          return text;
        }});
        toast('Survival state saved.');
        host.replaceChildren();
        await campResume(host, campaignName);
      } catch (error) {
        status.textContent = 'Failed: ' + error.message;
        saveButton.disabled = false;
      }
    };

    return h('div', { class:'survival-panel' },
      h('div', { class:'survival-title' }, h('h3', null, 'Mortal survival'), h('span', { class:'hint' }, 'manual state · higher reserves are better')),
      h('p', { class:'hint' }, state.present
        ? 'These values describe the body. They are separate from Personal Mana, Divine Mana, Divine Hunger, and Strain.'
        : 'This tracker predates survival gauges. Saving initializes the five reserves at 100 without automatic penalties.'),
      grid,
      h('div', { class:'survival-condition-editor' }, h('label', null, 'Named wounds and hazards'), list,
        h('div', { class:'survival-add' }, conditionInput, h('button', { class:'navbtn', type:'button', onclick:addCondition }, 'Add condition'))),
      h('div', { class:'toolrow' }, saveButton), status);
  };

  const install = () => {
    if (typeof campResume === 'function' && !campResume.__survivalPatched) {
      const original = campResume;
      const wrapped = async function(host, name) {
        await original(host, name);
        if (typeof ghReady !== 'function' || !ghReady()) return;
        try {
          const cfg = ghCfg();
          const files = await campaignFiles(cfg, name);
          if (!files.tracker) return;
          const result = await ghGetText(cfg, files.tracker);
          if (!result) return;
          host.append(makeEditor(cfg, files.tracker, result.text, host, name));
        } catch (error) {
          host.append(h('p', { class:'hint' }, 'Survival editor unavailable: ' + error.message));
        }
      };
      wrapped.__survivalPatched = true;
      campResume = wrapped;
    }

    // iOS/PWA fallback: open a campaign on pointer-up even when Safari drops the click.
    let openedAt = 0;
    document.addEventListener('pointerup', event => {
      try {
        if (typeof VIEW === 'undefined' || VIEW.name !== 'campaigns') return;
        const button = event.target && event.target.closest ? event.target.closest('.canon-list button.pick') : null;
        if (!button) return;
        const name = (button.querySelector('b')?.textContent || '').trim();
        if (!name || typeof go !== 'function') return;
        openedAt = Date.now();
        event.preventDefault();
        go('campaign', { name });
      } catch (_) {}
    }, true);
    document.addEventListener('click', event => {
      if (Date.now() - openedAt > 700) return;
      const button = event.target && event.target.closest ? event.target.closest('.canon-list button.pick') : null;
      if (button) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
