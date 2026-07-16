/**
 * Glass Panel Card
 * Carte Lovelace autonome : layout maison en CSS Grid, glassmorphism,
 * responsive reel (container queries). Aucune dependance.
 */

const VERSION = '1.0.0';

const ICONS_FALLBACK = 'mdi:help-circle-outline';

class GlassPanelCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._built = false;
    this._els = {};
  }

  static getConfigElement() { return null; }
  static getStubConfig() { return { tiles: [] }; }

  setConfig(config) {
    if (!config) throw new Error('Config manquante');
    this._config = {
      background: 'linear-gradient(150deg,#0a1c3d 0%,#14305c 28%,#0d5c63 58%,#123a6b 82%,#2a1a52 100%)',
      clock: true,
      pills: [],
      tiles: [],
      dock: [],
      ...config,
    };
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

  _st(id) {
    return this._hass && this._hass.states[id] ? this._hass.states[id] : null;
  }

  _name(id, fallback) {
    if (fallback) return fallback;
    const s = this._st(id);
    return s && s.attributes.friendly_name ? s.attributes.friendly_name : id;
  }

  _isOn(id) {
    const s = this._st(id);
    if (!s) return false;
    return ['on', 'playing', 'open', 'cleaning', 'home', 'cool', 'heat', 'dry', 'fan_only'].includes(s.state);
  }

  _call(domain, service, data) {
    if (this._hass) this._hass.callService(domain, service, data);
  }

  _more(entity) {
    const ev = new Event('hass-more-info', { bubbles: true, composed: true });
    ev.detail = { entityId: entity };
    this.dispatchEvent(ev);
  }

  _icon(name) {
    const el = document.createElement('ha-icon');
    el.setAttribute('icon', name || ICONS_FALLBACK);
    return el;
  }

  /* ---------------- construction (une seule fois) ---------------- */

  _build() {
    const c = this._config;
    const root = document.createElement('div');
    root.className = 'root';
    root.style.background = c.background;

    /* --- header --- */
    const header = document.createElement('div');
    header.className = 'header';

    if (c.clock) {
      const clock = document.createElement('div');
      clock.className = 'clockbox';
      const h = document.createElement('div');
      h.className = 'clock';
      const d = document.createElement('div');
      d.className = 'date';
      clock.append(h, d);
      header.append(clock);
      this._els.clock = h;
      this._els.date = d;
      this._tick();
      if (this._timer) clearInterval(this._timer);
      this._timer = setInterval(() => this._tick(), 10000);
    }

    if (c.pills && c.pills.length) {
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
        pills.append(el);
        this._els.pills.push({ cfg: p, txt: tx, icon: ic, el });
      });
      header.append(pills);
    }
    root.append(header);

    /* --- grille de tuiles --- */
    const grid = document.createElement('div');
    grid.className = 'grid';
    this._els.tiles = [];

    (c.tiles || []).forEach((t) => {
      const tile = document.createElement('div');
      tile.className = `tile span-${t.span || 1} ${t.type === 'hero' ? 'hero' : ''}`;

      const head = document.createElement('div');
      head.className = 'thead';
      const ic = this._icon(t.icon);
      ic.className = 'ticon';
      const nm = document.createElement('div');
      nm.className = 'tname';
      nm.textContent = this._name(t.entity, t.name);
      const stt = document.createElement('div');
      stt.className = 'tstate';
      head.append(ic, nm, stt);
      tile.append(head);

      const rec = { cfg: t, el: tile, icon: ic, name: nm, state: stt };

      /* corps selon le type */
      if (t.type === 'light') {
        const val = document.createElement('div');
        val.className = 'bigval';
        tile.append(val);
        rec.val = val;

        const row = document.createElement('div');
        row.className = 'row';
        const sl = document.createElement('input');
        sl.type = 'range'; sl.min = 1; sl.max = 100; sl.className = 'slider';
        sl.addEventListener('change', () => {
          this._call('light', 'turn_on', { entity_id: t.entity, brightness_pct: Number(sl.value) });
        });
        sl.addEventListener('click', (e) => e.stopPropagation());
        const tg = document.createElement('button');
        tg.className = 'mini';
        tg.append(this._icon('mdi:power'));
        tg.addEventListener('click', (e) => {
          e.stopPropagation();
          this._call('light', 'toggle', { entity_id: t.entity });
        });
        row.append(sl, tg);
        tile.append(row);
        rec.slider = sl;
      }

      if (t.type === 'select') {
        const sel = document.createElement('select');
        sel.className = 'select';
        sel.addEventListener('change', () => {
          this._call('input_select', 'select_option', { entity_id: t.entity, option: sel.value });
        });
        sel.addEventListener('click', (e) => e.stopPropagation());
        tile.append(sel);
        rec.select = sel;
      }

      if (t.type === 'climate') {
        const val = document.createElement('div');
        val.className = 'bigval';
        tile.append(val);
        rec.val = val;
        const row = document.createElement('div');
        row.className = 'row btns';
        (t.buttons || []).forEach((b) => {
          const bt = document.createElement('button');
          bt.className = 'chipbtn';
          bt.append(this._icon(b.icon));
          const lb = document.createElement('span');
          lb.textContent = b.name || '';
          bt.append(lb);
          bt.addEventListener('click', (e) => {
            e.stopPropagation();
            this._call(b.domain || 'climate', b.service, b.data || { entity_id: t.entity });
          });
          row.append(bt);
        });
        tile.append(row);
      }

      if (t.type === 'media') {
        const val = document.createElement('div');
        val.className = 'sub';
        tile.append(val);
        rec.val = val;
        const row = document.createElement('div');
        row.className = 'row';
        const sl = document.createElement('input');
        sl.type = 'range'; sl.min = 0; sl.max = 100; sl.className = 'slider';
        sl.addEventListener('change', () => {
          this._call('media_player', 'volume_set', { entity_id: t.entity, volume_level: Number(sl.value) / 100 });
        });
        sl.addEventListener('click', (e) => e.stopPropagation());
        const pp = document.createElement('button');
        pp.className = 'mini';
        pp.append(this._icon('mdi:play-pause'));
        pp.addEventListener('click', (e) => {
          e.stopPropagation();
          this._call('media_player', 'media_play_pause', { entity_id: t.entity });
        });
        row.append(sl, pp);
        tile.append(row);
        rec.slider = sl;
      }

      if (t.type === 'sensor' || t.type === 'hero') {
        const val = document.createElement('div');
        val.className = t.type === 'hero' ? 'heroval' : 'bigval';
        tile.append(val);
        rec.val = val;
        if (t.graph) {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'spark');
          svg.setAttribute('viewBox', '0 0 100 30');
          svg.setAttribute('preserveAspectRatio', 'none');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('vector-effect', 'non-scaling-stroke');
          svg.append(path);
          tile.append(svg);
          rec.spark = path;
        }
      }

      if (t.type === 'toggle') {
        tile.classList.add('compact');
        tile.addEventListener('click', () => {
          const dom = t.entity.split('.')[0];
          const svcDomain = ['switch', 'light', 'input_boolean', 'fan'].includes(dom) ? dom : 'homeassistant';
          this._call(svcDomain, 'toggle', { entity_id: t.entity });
        });
      }

      if (t.type === 'cover') {
        tile.classList.add('compact');
        const row = document.createElement('div');
        row.className = 'row btns';
        [['mdi:arrow-up', 'open_cover'], ['mdi:stop', 'stop_cover'], ['mdi:arrow-down', 'close_cover']].forEach(([i, s]) => {
          const bt = document.createElement('button');
          bt.className = 'mini';
          bt.append(this._icon(i));
          bt.addEventListener('click', (e) => { e.stopPropagation(); this._call('cover', s, { entity_id: t.entity }); });
          row.append(bt);
        });
        tile.append(row);
      }

      if (t.type === 'script') {
        tile.classList.add('compact');
        tile.addEventListener('click', () => this._call('script', 'turn_on', { entity_id: t.entity }));
      }

      if (!['toggle', 'script'].includes(t.type)) {
        head.addEventListener('click', () => this._more(t.entity));
        head.style.cursor = 'pointer';
      }

      grid.append(tile);
      this._els.tiles.push(rec);
    });

    root.append(grid);

    /* --- dock --- */
    if (c.dock && c.dock.length) {
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
        dock.append(b);
        this._els.dock.push({ cfg: d, txt: tx, icon: ic, el: b });
      });
      root.append(dock);
    }

    const style = document.createElement('style');
    style.textContent = CSS;
    this.shadowRoot.append(style, root);
    this._built = true;
  }

  _tick() {
    if (!this._els.clock) return;
    const n = new Date();
    this._els.clock.textContent = n.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this._els.date.textContent = n.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /* ---------------- mise a jour ---------------- */

  _update() {
    if (!this._built) return;

    (this._els.pills || []).forEach((p) => {
      const s = this._st(p.cfg.entity);
      const unit = s && s.attributes.unit_of_measurement ? ' ' + s.attributes.unit_of_measurement : '';
      p.txt.textContent = s ? `${s.state}${unit}` : '—';
      p.el.classList.toggle('active', this._isOn(p.cfg.entity));
      if (p.cfg.color) p.el.style.setProperty('--accent', p.cfg.color);
    });

    (this._els.tiles || []).forEach((t) => {
      const cfg = t.cfg;
      const s = this._st(cfg.entity);
      const on = this._isOn(cfg.entity);
      t.el.classList.toggle('on', on);
      if (cfg.color) t.el.style.setProperty('--accent', cfg.color);

      if (!s) {
        t.state.textContent = 'introuvable';
        t.el.classList.add('missing');
        return;
      }
      t.el.classList.remove('missing');

      const unit = s.attributes.unit_of_measurement || '';

      if (cfg.type === 'light') {
        const br = s.attributes.brightness;
        t.val.textContent = on ? `${Math.round((br || 255) / 2.55)} %` : 'Éteint';
        t.state.textContent = '';
        if (t.slider && document.activeElement !== t.slider) {
          t.slider.value = on ? Math.round((br || 255) / 2.55) : 1;
        }
      } else if (cfg.type === 'select') {
        if (t.select) {
          const opts = s.attributes.options || [];
          if (t.select.options.length !== opts.length) {
            t.select.innerHTML = '';
            opts.forEach((o) => {
              const op = document.createElement('option');
              op.value = o; op.textContent = o;
              t.select.append(op);
            });
          }
          if (document.activeElement !== t.select) t.select.value = s.state;
        }
        t.state.textContent = '';
      } else if (cfg.type === 'climate') {
        t.val.textContent = cfg.state_entity ? (this._st(cfg.state_entity)?.state || '—') : s.state;
        t.state.textContent = '';
      } else if (cfg.type === 'media') {
        const src = s.attributes.source || s.attributes.media_title || '—';
        t.val.textContent = src;
        t.state.textContent = s.state === 'playing' ? 'Lecture' : s.state;
        if (t.slider && document.activeElement !== t.slider) {
          t.slider.value = Math.round((s.attributes.volume_level || 0) * 100);
        }
      } else if (cfg.type === 'sensor' || cfg.type === 'hero') {
        const v = isNaN(Number(s.state)) ? s.state : Number(s.state).toFixed(cfg.decimals ?? 1);
        t.val.textContent = `${v}${unit ? ' ' + unit : ''}`;
        t.state.textContent = cfg.sub ? (this._st(cfg.sub)?.state || '') : '';
      } else {
        t.state.textContent = s.state;
      }
    });

    (this._els.dock || []).forEach((d) => {
      const s = this._st(d.cfg.entity);
      const unit = s && s.attributes.unit_of_measurement ? ' ' + s.attributes.unit_of_measurement : '';
      d.txt.textContent = d.cfg.label ? d.cfg.label : (s ? `${s.state}${unit}` : '—');
      d.el.classList.toggle('active', this._isOn(d.cfg.entity));
    });
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
  }
}

const CSS = `
:host { display:block; }
*, *::before, *::after { box-sizing:border-box; }

.root {
  --accent:#38bdf8;
  --glass:rgba(255,255,255,.07);
  --glass-brd:rgba(255,255,255,.14);
  --txt:#f2f7ff;
  --dim:rgba(242,247,255,.55);
  container-type:inline-size;
  border-radius:26px;
  padding:clamp(14px,2.4cqw,28px);
  color:var(--txt);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  min-height:60vh;
}

/* ---------- header ---------- */
.header {
  display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between;
  gap:16px; margin-bottom:clamp(14px,2cqw,26px);
}
.clock {
  font-size:clamp(38px,6.5cqw,72px); font-weight:200; letter-spacing:-2px;
  line-height:1; text-shadow:0 6px 34px rgba(0,0,0,.45);
}
.date {
  font-size:clamp(11px,1.1cqw,14px); font-weight:300; letter-spacing:3px;
  text-transform:uppercase; color:var(--dim); margin-top:6px;
}
.pills { display:flex; flex-wrap:wrap; gap:8px; }
.pill {
  display:inline-flex; align-items:center; gap:7px;
  padding:7px 14px 7px 10px; border-radius:999px; cursor:pointer;
  background:var(--glass); border:1px solid var(--glass-brd); color:var(--txt);
  backdrop-filter:blur(22px) saturate(150%); -webkit-backdrop-filter:blur(22px) saturate(150%);
  font-size:13px; font-weight:500; transition:all .18s ease;
}
.pill:hover { background:rgba(255,255,255,.13); transform:translateY(-1px); }
.pill ha-icon { --mdc-icon-size:17px; color:var(--dim); }
.pill.active ha-icon { color:var(--accent); filter:drop-shadow(0 0 7px var(--accent)); }

/* ---------- grille ---------- */
.grid {
  display:grid; gap:clamp(10px,1.3cqw,16px);
  grid-template-columns:repeat(4,minmax(0,1fr));
  grid-auto-rows:minmax(96px,auto);
}
@container (max-width:1100px) { .grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@container (max-width:800px)  { .grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@container (max-width:460px)  { .grid { grid-template-columns:repeat(1,minmax(0,1fr)); } }

.span-2 { grid-column:span 2; }
.span-3 { grid-column:span 3; }
.span-4 { grid-column:span 4; }
@container (max-width:800px) { .span-3,.span-4 { grid-column:span 2; } }
@container (max-width:460px) { .span-2,.span-3,.span-4 { grid-column:span 1; } }

.tile {
  position:relative; display:flex; flex-direction:column; gap:10px;
  padding:16px; border-radius:24px; overflow:hidden;
  background:var(--glass); border:1px solid var(--glass-brd);
  backdrop-filter:blur(26px) saturate(150%); -webkit-backdrop-filter:blur(26px) saturate(150%);
  box-shadow:0 8px 30px rgba(0,0,0,.26);
  transition:transform .18s ease, background .18s ease, border-color .18s ease;
}
.tile:hover { transform:translateY(-2px); border-color:rgba(255,255,255,.24); }
.tile.on { border-color:color-mix(in srgb, var(--accent) 55%, transparent); box-shadow:0 8px 30px rgba(0,0,0,.3), 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent) inset; }
.tile.compact { justify-content:space-between; }
.tile.missing { border-color:rgba(255,80,80,.5); }
.tile.hero { justify-content:center; align-items:flex-start; }

.thead { display:flex; align-items:center; gap:9px; }
.ticon { --mdc-icon-size:20px; color:var(--dim); flex:0 0 auto; transition:color .18s ease; }
.tile.on .ticon { color:var(--accent); filter:drop-shadow(0 0 8px var(--accent)); }
.tname {
  font-size:13px; font-weight:600; letter-spacing:.4px; flex:1 1 auto;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.tstate { font-size:11px; color:var(--dim); white-space:nowrap; }

.bigval { font-size:clamp(20px,2.1cqw,26px); font-weight:300; letter-spacing:-.5px; }
.heroval { font-size:clamp(34px,4.6cqw,58px); font-weight:200; letter-spacing:-2px; line-height:1; }
.sub { font-size:13px; color:var(--dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.row { display:flex; align-items:center; gap:8px; margin-top:auto; }
.row.btns { flex-wrap:wrap; }

/* slider */
.slider {
  -webkit-appearance:none; appearance:none; flex:1 1 auto; height:34px; border-radius:12px;
  background:rgba(255,255,255,.10); outline:none; cursor:pointer; border:1px solid var(--glass-brd);
}
.slider::-webkit-slider-thumb {
  -webkit-appearance:none; width:20px; height:26px; border-radius:8px;
  background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.4); cursor:grab;
}
.slider::-moz-range-thumb {
  width:20px; height:26px; border:none; border-radius:8px; background:#fff;
  box-shadow:0 2px 8px rgba(0,0,0,.4); cursor:grab;
}

.mini, .chipbtn {
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  min-width:38px; height:34px; padding:0 10px; border-radius:12px; cursor:pointer;
  background:rgba(255,255,255,.10); border:1px solid var(--glass-brd); color:var(--txt);
  transition:all .16s ease; font-size:12px; font-weight:500;
}
.mini:hover, .chipbtn:hover { background:rgba(255,255,255,.2); }
.mini ha-icon, .chipbtn ha-icon { --mdc-icon-size:18px; }

.select {
  width:100%; height:38px; padding:0 12px; border-radius:12px; cursor:pointer;
  background:rgba(255,255,255,.10); border:1px solid var(--glass-brd); color:var(--txt);
  font-size:13px; font-weight:500; outline:none; margin-top:auto;
}
.select option { background:#12233f; color:#fff; }

.spark { width:100%; height:34px; margin-top:auto; opacity:.85; }
.spark path { stroke:var(--accent); }

/* ---------- dock ---------- */
.dock {
  display:flex; flex-wrap:wrap; justify-content:center; gap:9px;
  margin-top:clamp(14px,2cqw,24px);
}
.dockchip {
  display:inline-flex; align-items:center; gap:8px; padding:9px 16px 9px 12px;
  border-radius:999px; cursor:pointer; color:var(--txt);
  background:var(--glass); border:1px solid var(--glass-brd);
  backdrop-filter:blur(22px) saturate(150%); -webkit-backdrop-filter:blur(22px) saturate(150%);
  font-size:13px; font-weight:500; transition:all .18s ease;
}
.dockchip:hover { background:rgba(255,255,255,.15); transform:translateY(-2px); }
.dockchip ha-icon { --mdc-icon-size:18px; color:var(--dim); }
.dockchip.active ha-icon { color:var(--accent); filter:drop-shadow(0 0 7px var(--accent)); }
`;

customElements.define('glass-panel-card', GlassPanelCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'glass-panel-card',
  name: 'Glass Panel Card',
  description: 'Panneau glassmorphism autonome, layout CSS Grid responsive',
  preview: false,
});

console.info(`%c GLASS-PANEL-CARD %c v${VERSION} `,
  'color:#0b1e3d;background:#38bdf8;font-weight:700;border-radius:4px 0 0 4px;padding:2px 6px',
  'color:#38bdf8;background:#0b1e3d;border-radius:0 4px 4px 0;padding:2px 6px');
