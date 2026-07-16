/**
 * Glass Panel Card
 * Carte Lovelace autonome : layout maison en CSS Grid, glassmorphism,
 * onglets, responsive reel (container queries). Aucune dependance.
 */

const VERSION = '2.0.0';
const ICON_FB = 'mdi:help-circle-outline';

class GlassPanelCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._built = false;
    this._tab = 0;
    this._els = {};
  }

  static getStubConfig() { return { tabs: [] }; }

  setConfig(config) {
    if (!config) throw new Error('Config manquante');
    const c = {
      background: 'linear-gradient(160deg,#081428,#0d2547 45%,#0a1c38)',
      clock: true,
      max_width: 1280,
      pills: [],
      dock: [],
      ...config,
    };
    // retro-compat : tiles a la racine => un onglet implicite
    if (!c.tabs && c.tiles) c.tabs = [{ name: '', tiles: c.tiles }];
    if (!c.tabs) c.tabs = [];
    this._config = c;
    this._tab = 0;
    this._built = false;
    if (this.shadowRoot) this.shadowRoot.innerHTML = '';
  }

  getCardSize() { return 12; }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  /* ---------------- helpers ---------------- */

  _st(id) { return this._hass && id && this._hass.states[id] ? this._hass.states[id] : null; }

  _name(id, fb) {
    if (fb) return fb;
    const s = this._st(id);
    return s && s.attributes.friendly_name ? s.attributes.friendly_name : (id || '');
  }

  _isOn(id) {
    const s = this._st(id);
    if (!s) return false;
    if (['off', 'unavailable', 'unknown', 'idle', 'docked', 'not_home', 'closed', 'standby'].includes(s.state)) return false;
    if (!isNaN(Number(s.state))) return Number(s.state) > 0;
    return true;
  }

  _call(domain, service, data) { if (this._hass) this._hass.callService(domain, service, data); }

  _more(entity) {
    if (!entity) return;
    const ev = new Event('hass-more-info', { bubbles: true, composed: true });
    ev.detail = { entityId: entity };
    this.dispatchEvent(ev);
  }

  _icon(name) {
    const el = document.createElement('ha-icon');
    el.setAttribute('icon', name || ICON_FB);
    return el;
  }

  /* ---------------- construction ---------------- */

  _build() {
    const c = this._config;
    const root = document.createElement('div');
    root.className = 'root';
    root.style.background = c.background;

    const inner = document.createElement('div');
    inner.className = 'inner';
    inner.style.maxWidth = typeof c.max_width === 'number' ? `${c.max_width}px` : c.max_width;

    /* ---- header ---- */
    const header = document.createElement('div');
    header.className = 'header';

    if (c.clock) {
      const box = document.createElement('div');
      box.className = 'clockbox';
      const h = document.createElement('div'); h.className = 'clock';
      const d = document.createElement('div'); d.className = 'date';
      box.append(h, d);
      header.append(box);
      this._els.clock = h; this._els.date = d;
      this._tick();
      if (this._timer) clearInterval(this._timer);
      this._timer = setInterval(() => this._tick(), 10000);
    }

    if (c.pills.length) {
      const pills = document.createElement('div');
      pills.className = 'pills';
      this._els.pills = [];
      c.pills.forEach((p) => {
        const el = document.createElement('button');
        el.className = 'pill';
        const ic = this._icon(p.icon);
        const tx = document.createElement('span');
        el.append(ic, tx);
        el.addEventListener('click', () => this._more(p.entity));
        if (p.color) el.style.setProperty('--accent', p.color);
        pills.append(el);
        this._els.pills.push({ cfg: p, txt: tx, el });
      });
      header.append(pills);
    }
    inner.append(header);

    /* ---- barre d'onglets ---- */
    if (c.tabs.length > 1) {
      const bar = document.createElement('div');
      bar.className = 'tabbar';
      this._els.tabbtns = [];
      c.tabs.forEach((t, i) => {
        const b = document.createElement('button');
        b.className = 'tab';
        b.append(this._icon(t.icon));
        const s = document.createElement('span');
        s.textContent = t.name || `Onglet ${i + 1}`;
        b.append(s);
        if (t.color) b.style.setProperty('--accent', t.color);
        b.addEventListener('click', () => this._switch(i));
        bar.append(b);
        this._els.tabbtns.push(b);
      });
      inner.append(bar);
    }

    /* ---- grilles (une par onglet) ---- */
    this._els.grids = [];
    this._els.tiles = [];
    c.tabs.forEach((tab, i) => {
      const grid = document.createElement('div');
      grid.className = 'grid';
      if (i !== 0) grid.style.display = 'none';
      (tab.tiles || []).forEach((t) => {
        const rec = this._buildTile(t);
        grid.append(rec.el);
        this._els.tiles.push(rec);
      });
      inner.append(grid);
      this._els.grids.push(grid);
    });

    /* ---- dock ---- */
    if (c.dock.length) {
      const dock = document.createElement('div');
      dock.className = 'dock';
      this._els.dock = [];
      c.dock.forEach((d) => {
        const b = document.createElement('button');
        b.className = 'dockchip';
        const ic = this._icon(d.icon);
        const tx = document.createElement('span');
        b.append(ic, tx);
        b.addEventListener('click', () => this._more(d.entity));
        if (d.color) b.style.setProperty('--accent', d.color);
        dock.append(b);
        this._els.dock.push({ cfg: d, txt: tx, el: b });
      });
      inner.append(dock);
    }

    root.append(inner);
    const style = document.createElement('style');
    style.textContent = CSS;
    this.shadowRoot.append(style, root);
    this._built = true;
    this._switch(0);
  }

  _switch(i) {
    this._tab = i;
    (this._els.grids || []).forEach((g, k) => { g.style.display = k === i ? '' : 'none'; });
    (this._els.tabbtns || []).forEach((b, k) => b.classList.toggle('active', k === i));
  }

  _buildTile(t) {
    const tile = document.createElement('div');
    tile.className = `tile span-${t.span || 1}`;
    if (t.color) tile.style.setProperty('--accent', t.color);

    const head = document.createElement('div');
    head.className = 'thead';
    const ic = this._icon(t.icon); ic.className = 'ticon';
    const nm = document.createElement('div'); nm.className = 'tname';
    nm.textContent = this._name(t.entity, t.name);
    const stt = document.createElement('div'); stt.className = 'tstate';
    head.append(ic, nm, stt);
    tile.append(head);

    const rec = { cfg: t, el: tile, name: nm, state: stt };

    switch (t.type) {
      case 'hero': {
        const v = document.createElement('div'); v.className = 'heroval';
        tile.append(v); rec.val = v;
        tile.classList.add('hero');
        break;
      }
      case 'gauge': {
        const wrap = document.createElement('div'); wrap.className = 'gwrap';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 120 120'); svg.setAttribute('class', 'gauge');
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        [['cx', 60], ['cy', 60], ['r', 50], ['fill', 'none'], ['stroke-width', 9]].forEach(([k, val]) => bg.setAttribute(k, val));
        bg.setAttribute('class', 'gbg');
        const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        [['cx', 60], ['cy', 60], ['r', 50], ['fill', 'none'], ['stroke-width', 9], ['stroke-linecap', 'round']].forEach(([k, val]) => fg.setAttribute(k, val));
        fg.setAttribute('class', 'gfg');
        fg.setAttribute('transform', 'rotate(-90 60 60)');
        svg.append(bg, fg);
        const lab = document.createElement('div'); lab.className = 'glabel';
        wrap.append(svg, lab);
        tile.append(wrap);
        rec.gauge = fg; rec.val = lab;
        break;
      }
      case 'light': {
        const v = document.createElement('div'); v.className = 'bigval';
        tile.append(v); rec.val = v;
        const row = document.createElement('div'); row.className = 'row';
        const sl = document.createElement('input');
        sl.type = 'range'; sl.min = 1; sl.max = 100; sl.className = 'slider';
        sl.addEventListener('change', () => this._call('light', 'turn_on', { entity_id: t.entity, brightness_pct: Number(sl.value) }));
        sl.addEventListener('click', (e) => e.stopPropagation());
        const tg = document.createElement('button'); tg.className = 'mini';
        tg.append(this._icon('mdi:power'));
        tg.addEventListener('click', (e) => { e.stopPropagation(); this._call('light', 'toggle', { entity_id: t.entity }); });
        row.append(sl, tg); tile.append(row); rec.slider = sl;
        break;
      }
      case 'select': {
        const sel = document.createElement('select'); sel.className = 'select';
        sel.addEventListener('change', () => this._call('input_select', 'select_option', { entity_id: t.entity, option: sel.value }));
        sel.addEventListener('click', (e) => e.stopPropagation());
        tile.append(sel); rec.select = sel;
        break;
      }
      case 'climate': {
        const v = document.createElement('div'); v.className = 'bigval';
        tile.append(v); rec.val = v;
        const row = document.createElement('div'); row.className = 'row btns';
        (t.buttons || []).forEach((b) => {
          const bt = document.createElement('button'); bt.className = 'chipbtn';
          bt.append(this._icon(b.icon));
          if (b.name) { const l = document.createElement('span'); l.textContent = b.name; bt.append(l); }
          bt.addEventListener('click', (e) => { e.stopPropagation(); this._call(b.domain || 'climate', b.service, b.data || { entity_id: t.entity }); });
          row.append(bt);
        });
        tile.append(row);
        break;
      }
      case 'media': {
        const v = document.createElement('div'); v.className = 'sub';
        tile.append(v); rec.val = v;
        const row = document.createElement('div'); row.className = 'row';
        const sl = document.createElement('input');
        sl.type = 'range'; sl.min = 0; sl.max = 100; sl.className = 'slider';
        sl.addEventListener('change', () => this._call('media_player', 'volume_set', { entity_id: t.entity, volume_level: Number(sl.value) / 100 }));
        sl.addEventListener('click', (e) => e.stopPropagation());
        const pp = document.createElement('button'); pp.className = 'mini';
        pp.append(this._icon('mdi:play-pause'));
        pp.addEventListener('click', (e) => { e.stopPropagation(); this._call('media_player', 'media_play_pause', { entity_id: t.entity }); });
        row.append(sl, pp); tile.append(row); rec.slider = sl;
        break;
      }
      case 'cover': {
        tile.classList.add('compact');
        const row = document.createElement('div'); row.className = 'row btns';
        [['mdi:arrow-up', 'open_cover'], ['mdi:stop', 'stop_cover'], ['mdi:arrow-down', 'close_cover']].forEach(([i, s]) => {
          const bt = document.createElement('button'); bt.className = 'mini';
          bt.append(this._icon(i));
          bt.addEventListener('click', (e) => { e.stopPropagation(); this._call('cover', s, { entity_id: t.entity }); });
          row.append(bt);
        });
        tile.append(row);
        break;
      }
      case 'button': {
        tile.classList.add('compact', 'clickable');
        const v = document.createElement('div'); v.className = 'sub';
        tile.append(v); rec.val = v;
        tile.addEventListener('click', () => this._call('button', 'press', { entity_id: t.entity }));
        break;
      }
      case 'toggle': {
        tile.classList.add('compact', 'clickable');
        tile.addEventListener('click', () => {
          const dom = (t.entity || '').split('.')[0];
          const svc = ['switch', 'light', 'input_boolean', 'fan', 'media_player'].includes(dom) ? dom : 'homeassistant';
          this._call(svc, 'toggle', { entity_id: t.entity });
        });
        break;
      }
      case 'script': {
        tile.classList.add('compact', 'clickable');
        tile.addEventListener('click', () => this._call('script', 'turn_on', { entity_id: t.entity }));
        break;
      }
      default: { // sensor
        const v = document.createElement('div'); v.className = 'bigval';
        tile.append(v); rec.val = v;
      }
    }

    if (!['toggle', 'script', 'button'].includes(t.type)) {
      head.style.cursor = 'pointer';
      head.addEventListener('click', () => this._more(t.entity));
    }
    return rec;
  }

  _tick() {
    if (!this._els.clock) return;
    const n = new Date();
    this._els.clock.textContent = n.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this._els.date.textContent = n.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /* ---------------- mise a jour ---------------- */

  _fmt(s, cfg) {
    if (!s) return '—';
    let v = s.state;
    if (!isNaN(Number(v))) {
      let n = Number(v);
      if (cfg.factor) n *= cfg.factor;
      v = n.toFixed(cfg.decimals ?? 1);
    }
    const u = cfg.unit !== undefined ? cfg.unit : (s.attributes.unit_of_measurement || '');
    return u ? `${v} ${u}` : `${v}`;
  }

  _update() {
    if (!this._built) return;

    (this._els.pills || []).forEach((p) => {
      const s = this._st(p.cfg.entity);
      p.txt.textContent = this._fmt(s, p.cfg);
      p.el.classList.toggle('active', this._isOn(p.cfg.entity));
    });

    (this._els.tiles || []).forEach((t) => {
      const cfg = t.cfg;
      const s = this._st(cfg.entity);
      const on = this._isOn(cfg.entity);
      t.el.classList.toggle('on', on);

      if (!s) {
        t.state.textContent = 'introuvable';
        t.el.classList.add('missing');
        return;
      }
      t.el.classList.remove('missing');
      t.el.classList.toggle('dead', ['unavailable', 'unknown'].includes(s.state));

      switch (cfg.type) {
        case 'light': {
          const br = s.attributes.brightness;
          t.val.textContent = on ? `${Math.round((br || 255) / 2.55)} %` : 'Éteint';
          if (t.slider && document.activeElement !== t.slider) t.slider.value = on ? Math.round((br || 255) / 2.55) : 1;
          break;
        }
        case 'select': {
          const opts = s.attributes.options || [];
          if (t.select.options.length !== opts.length) {
            t.select.innerHTML = '';
            opts.forEach((o) => { const op = document.createElement('option'); op.value = o; op.textContent = o; t.select.append(op); });
          }
          if (document.activeElement !== t.select) t.select.value = s.state;
          break;
        }
        case 'climate': {
          t.val.textContent = cfg.state_entity ? (this._st(cfg.state_entity)?.state || '—') : s.state;
          break;
        }
        case 'media': {
          t.val.textContent = s.attributes.source || s.attributes.media_title || '—';
          t.state.textContent = s.state === 'playing' ? 'Lecture' : s.state;
          if (t.slider && document.activeElement !== t.slider) t.slider.value = Math.round((s.attributes.volume_level || 0) * 100);
          break;
        }
        case 'gauge': {
          const n = Number(s.state);
          const pct = isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
          const circ = 2 * Math.PI * 50;
          t.gauge.setAttribute('stroke-dasharray', `${(pct / 100) * circ} ${circ}`);
          t.val.textContent = this._fmt(s, cfg);
          break;
        }
        case 'toggle': case 'script': case 'cover': {
          t.state.textContent = ['unavailable', 'unknown'].includes(s.state) ? '—' : s.state;
          break;
        }
        case 'button': {
          t.val.textContent = cfg.sub_text || 'Appuyer';
          break;
        }
        default: {
          t.val.textContent = this._fmt(s, cfg);
          if (cfg.sub) t.state.textContent = this._fmt(this._st(cfg.sub), { decimals: 0 });
        }
      }
    });

    (this._els.dock || []).forEach((d) => {
      const s = this._st(d.cfg.entity);
      d.txt.textContent = d.cfg.label || this._fmt(s, d.cfg);
      d.el.classList.toggle('active', this._isOn(d.cfg.entity));
    });
  }

  disconnectedCallback() { if (this._timer) clearInterval(this._timer); }
}

const CSS = `
:host { display:block; }
*, *::before, *::after { box-sizing:border-box; }

.root {
  --accent:#38bdf8;
  --glass:rgba(255,255,255,.07);
  --brd:rgba(255,255,255,.14);
  --txt:#f2f7ff;
  --dim:rgba(242,247,255,.55);
  min-height:100vh;
  padding:clamp(16px,2.2vw,34px) clamp(12px,2vw,28px);
  color:var(--txt);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}

/* centrage */
.inner {
  container-type:inline-size;
  margin:0 auto;
  width:100%;
  display:flex;
  flex-direction:column;
}

/* ---------- header ---------- */
.header {
  display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between;
  gap:16px; margin-bottom:clamp(12px,1.6cqw,20px);
}
.clock { font-size:clamp(40px,5.6cqw,68px); font-weight:200; letter-spacing:-2px; line-height:1;
  text-shadow:0 6px 34px rgba(0,0,0,.45); }
.date { font-size:clamp(11px,1cqw,13px); font-weight:300; letter-spacing:3px;
  text-transform:uppercase; color:var(--dim); margin-top:6px; }

.pills { display:flex; flex-wrap:wrap; gap:8px; }
.pill {
  display:inline-flex; align-items:center; gap:7px; padding:7px 14px 7px 10px;
  border-radius:999px; cursor:pointer; color:var(--txt); font:500 13px inherit;
  background:var(--glass); border:1px solid var(--brd);
  backdrop-filter:blur(22px) saturate(150%); -webkit-backdrop-filter:blur(22px) saturate(150%);
  transition:all .18s ease;
}
.pill:hover { background:rgba(255,255,255,.14); transform:translateY(-1px); }
.pill ha-icon { --mdc-icon-size:17px; color:var(--dim); transition:color .18s ease; }
.pill.active ha-icon { color:var(--accent); filter:drop-shadow(0 0 7px var(--accent)); }

/* ---------- onglets ---------- */
.tabbar {
  display:flex; flex-wrap:wrap; gap:8px; margin-bottom:clamp(12px,1.6cqw,20px);
  padding:6px; border-radius:999px; align-self:flex-start;
  background:rgba(255,255,255,.05); border:1px solid var(--brd);
  backdrop-filter:blur(22px) saturate(150%); -webkit-backdrop-filter:blur(22px) saturate(150%);
}
.tab {
  display:inline-flex; align-items:center; gap:8px; padding:9px 18px;
  border-radius:999px; cursor:pointer; border:1px solid transparent;
  background:transparent; color:var(--dim); font:600 13.5px inherit; letter-spacing:.3px;
  transition:all .2s ease;
}
.tab ha-icon { --mdc-icon-size:18px; }
.tab:hover { color:var(--txt); background:rgba(255,255,255,.07); }
.tab.active {
  color:#0a1628; background:#fff; border-color:#fff;
  box-shadow:0 4px 18px rgba(0,0,0,.3);
}
.tab.active ha-icon { color:var(--accent); }

/* ---------- grille ---------- */
.grid {
  display:grid; gap:clamp(10px,1.2cqw,16px);
  grid-template-columns:repeat(4,minmax(0,1fr));
  grid-auto-rows:minmax(104px,auto);
}
@container (max-width:1000px) { .grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@container (max-width:720px)  { .grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@container (max-width:430px)  { .grid { grid-template-columns:repeat(1,minmax(0,1fr)); } }

.span-2 { grid-column:span 2; }
.span-3 { grid-column:span 3; }
.span-4 { grid-column:span 4; }
@container (max-width:720px) { .span-3,.span-4 { grid-column:span 2; } }
@container (max-width:430px) { .span-2,.span-3,.span-4 { grid-column:span 1; } }

.tile {
  position:relative; display:flex; flex-direction:column; gap:10px;
  padding:16px; border-radius:24px; overflow:hidden;
  background:var(--glass); border:1px solid var(--brd);
  backdrop-filter:blur(26px) saturate(150%); -webkit-backdrop-filter:blur(26px) saturate(150%);
  box-shadow:0 8px 30px rgba(0,0,0,.26);
  transition:transform .18s ease, background .18s ease, border-color .18s ease;
}
.tile:hover { transform:translateY(-2px); border-color:rgba(255,255,255,.26); }
.tile.clickable { cursor:pointer; }
.tile.on { border-color:color-mix(in srgb, var(--accent) 55%, transparent); }
.tile.on::after {
  content:''; position:absolute; inset:0; pointer-events:none; border-radius:24px;
  background:radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%);
}
.tile.compact { justify-content:space-between; }
.tile.missing { border-color:rgba(248,113,113,.55); }
.tile.dead { opacity:.45; }
.tile.hero { justify-content:center; }

.thead { display:flex; align-items:center; gap:9px; position:relative; z-index:1; }
.ticon { --mdc-icon-size:20px; color:var(--dim); flex:0 0 auto; transition:color .18s ease; }
.tile.on .ticon { color:var(--accent); filter:drop-shadow(0 0 8px var(--accent)); }
.tname { font-size:13px; font-weight:600; letter-spacing:.3px; flex:1 1 auto;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tstate { font-size:11px; color:var(--dim); white-space:nowrap; }

.bigval { font-size:clamp(19px,1.9cqw,25px); font-weight:300; letter-spacing:-.4px; position:relative; z-index:1; }
.heroval { font-size:clamp(34px,4.2cqw,56px); font-weight:200; letter-spacing:-2px; line-height:1; position:relative; z-index:1; }
.sub { font-size:13px; color:var(--dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; position:relative; z-index:1; }

.row { display:flex; align-items:center; gap:8px; margin-top:auto; position:relative; z-index:1; }
.row.btns { flex-wrap:wrap; }

/* jauge */
.gwrap { position:relative; display:grid; place-items:center; margin-top:auto; }
.gauge { width:clamp(96px,9cqw,132px); aspect-ratio:1; }
.gbg { stroke:rgba(255,255,255,.10); }
.gfg { stroke:var(--accent); filter:drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 60%, transparent));
  transition:stroke-dasharray .6s cubic-bezier(.4,0,.2,1); }
.glabel { position:absolute; font-size:clamp(17px,1.7cqw,22px); font-weight:300; letter-spacing:-.5px; }

/* slider */
.slider {
  -webkit-appearance:none; appearance:none; flex:1 1 auto; height:34px; border-radius:12px;
  background:rgba(255,255,255,.10); outline:none; cursor:pointer; border:1px solid var(--brd);
}
.slider::-webkit-slider-thumb { -webkit-appearance:none; width:20px; height:26px; border-radius:8px;
  background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.4); cursor:grab; }
.slider::-moz-range-thumb { width:20px; height:26px; border:none; border-radius:8px; background:#fff;
  box-shadow:0 2px 8px rgba(0,0,0,.4); cursor:grab; }

.mini, .chipbtn {
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  min-width:38px; height:34px; padding:0 11px; border-radius:12px; cursor:pointer;
  background:rgba(255,255,255,.10); border:1px solid var(--brd); color:var(--txt);
  font:500 12px inherit; transition:all .16s ease;
}
.mini:hover, .chipbtn:hover { background:rgba(255,255,255,.22); }
.mini ha-icon, .chipbtn ha-icon { --mdc-icon-size:18px; }

.select {
  width:100%; height:38px; padding:0 12px; border-radius:12px; cursor:pointer; margin-top:auto;
  background:rgba(255,255,255,.10); border:1px solid var(--brd); color:var(--txt);
  font:500 13px inherit; outline:none; position:relative; z-index:1;
}
.select option { background:#12233f; color:#fff; }

/* ---------- dock ---------- */
.dock { display:flex; flex-wrap:wrap; justify-content:center; gap:9px; margin-top:clamp(14px,1.8cqw,24px); }
.dockchip {
  display:inline-flex; align-items:center; gap:8px; padding:9px 16px 9px 12px;
  border-radius:999px; cursor:pointer; color:var(--txt); font:500 13px inherit;
  background:var(--glass); border:1px solid var(--brd);
  backdrop-filter:blur(22px) saturate(150%); -webkit-backdrop-filter:blur(22px) saturate(150%);
  transition:all .18s ease;
}
.dockchip:hover { background:rgba(255,255,255,.16); transform:translateY(-2px); }
.dockchip ha-icon { --mdc-icon-size:18px; color:var(--dim); }
.dockchip.active ha-icon { color:var(--accent); filter:drop-shadow(0 0 7px var(--accent)); }
`;

customElements.define('glass-panel-card', GlassPanelCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'glass-panel-card',
  name: 'Glass Panel Card',
  description: 'Panneau glassmorphism autonome, onglets, layout CSS Grid responsive',
  preview: false,
});

console.info(`%c GLASS-PANEL-CARD %c v${VERSION} `,
  'color:#0b1e3d;background:#38bdf8;font-weight:700;border-radius:4px 0 0 4px;padding:2px 6px',
  'color:#38bdf8;background:#0b1e3d;border-radius:0 4px 4px 0;padding:2px 6px');
