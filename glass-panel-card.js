/**
 * Glass Panel Card
 * Carte Lovelace autonome : layout maison en CSS Grid, glassmorphism,
 * onglets, responsive reel (container queries). Aucune dependance.
 */

const VERSION = '4.1.0';

// Etats bruts de HA -> libelle francais. Surchargeable par tuile via `translate`.
const STATE_FR = {
  on: 'Allumé', off: 'Éteint',
  home: 'À la maison', not_home: 'Absent',
  open: 'Ouvert', closed: 'Fermé', opening: 'Ouverture…', closing: 'Fermeture…',
  playing: 'Lecture', paused: 'En pause', idle: 'Inactif', standby: 'Veille', buffering: 'Chargement…',
  docked: 'À la base', cleaning: 'Nettoyage', returning: 'Retour à la base', error: 'Erreur',
  charging: 'En charge', discharging: 'Décharge', not_charging: 'Pas en charge', full: 'Pleine',
  unavailable: 'Indisponible', unknown: 'Inconnu', none: 'Aucun',
  auto: 'Auto', heat: 'Chauffage', cool: 'Froid', fan_only: 'Ventilation', heat_cool: 'Auto',
  // Renault / Dacia
  not_in_charge: 'Pas en charge', charge_in_progress: 'En charge', charge_error: 'Erreur de charge',
  waiting_for_a_planned_charge: 'Charge programmée', charge_ended: 'Charge terminée',
  waiting_for_current_charge: 'En attente', energy_flap_opened: 'Trappe ouverte',
};

// Largeur de base par "span". Combine a flex-grow, une ligne se remplit
// toujours entierement : plus de trou a droite quand le compte ne tombe pas juste.
const BASIS = { 1: 152, 2: 250, 3: 340, 4: 430, 6: 620 };
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

    /* ---- pages (une par onglet), chacune decoupee en sections ---- */
    this._els.grids = [];
    this._els.tiles = [];
    c.tabs.forEach((tab, i) => {
      const page = document.createElement('div');
      page.className = 'page';
      if (i !== 0) page.style.display = 'none';

      // retro-compat : un onglet sans sections = une section unique sans titre
      const sections = tab.sections || [{ tiles: tab.tiles || [] }];
      sections.forEach((sec) => {
        const box = document.createElement('div');
        box.className = 'section';
        if (sec.color) box.style.setProperty('--accent', sec.color);

        if (sec.title) {
          const head = document.createElement('div');
          head.className = 'sechead';
          if (sec.icon) head.append(this._icon(sec.icon));
          const lbl = document.createElement('div');
          lbl.className = 'sectitle';
          lbl.textContent = sec.title;
          const line = document.createElement('div');
          line.className = 'secline';
          head.append(lbl, line);
          box.append(head);
        }

        const grid = document.createElement('div');
        grid.className = 'grid';
        (sec.tiles || []).forEach((t) => {
          const rec = this._buildTile(t);
          grid.append(rec.el);
          this._els.tiles.push(rec);
        });
        box.append(grid);
        page.append(box);
      });

      inner.append(page);
      this._els.grids.push(page);
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
    tile.className = 'tile';
    const sp = Math.min(6, Math.max(1, t.span || 1));
    tile.style.setProperty('--g', sp);
    tile.style.setProperty('--b', `${BASIS[sp] || BASIS[1]}px`);
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

  // etat brut -> libelle lisible : `translate` de la tuile, sinon dictionnaire global
  _tr(v, cfg) {
    if (cfg && cfg.translate && cfg.translate[v] !== undefined) return cfg.translate[v];
    return STATE_FR[v] !== undefined ? STATE_FR[v] : v;
  }

  _fmt(s, cfg) {
    if (!s) return '—';
    const v = s.state;
    // valeur numerique : facteur, arrondi, unite
    if (v !== '' && !isNaN(Number(v))) {
      let n = Number(v);
      if (cfg.factor) n *= cfg.factor;
      const num = n.toFixed(cfg.decimals ?? 1);
      const u = cfg.unit !== undefined ? cfg.unit : (s.attributes.unit_of_measurement || '');
      return u ? `${num} ${u}` : `${num}`;
    }
    // etat textuel : pas d'unite a coller, on traduit
    return this._tr(v, cfg);
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
      if (cfg.state_colors) {
        const k = this._st(cfg.state_colors_entity || cfg.state_entity || cfg.entity);
        const col = k ? cfg.state_colors[k.state] : null;
        if (col) t.el.style.setProperty('--accent', col);
        t.el.classList.toggle('muted', col === cfg.state_colors.__off);
      }

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
          const src = cfg.state_entity ? this._st(cfg.state_entity) : s;
          t.val.textContent = src ? this._tr(src.state, cfg) : '—';
          break;
        }
        case 'media': {
          t.val.textContent = s.attributes.source || s.attributes.media_title || '—';
          t.state.textContent = this._tr(s.state, cfg);
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
          t.state.textContent = ['unavailable', 'unknown'].includes(s.state) ? '—' : this._tr(s.state, cfg);
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
  --brd:rgba(255,255,255,.13);
  --txt:#f2f7ff;
  --dim:rgba(242,247,255,.52);
  min-height:100vh;
  padding:clamp(10px,1.4vw,22px) clamp(10px,1.4vw,20px);
  color:var(--txt);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}

.inner { container-type:inline-size; margin:0 auto; width:100%; display:flex; flex-direction:column; }

/* ---------- header ---------- */
.header {
  display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between;
  gap:12px; margin-bottom:clamp(9px,1cqw,13px);
}
.clock { font-size:clamp(27px,3.2cqw,40px); font-weight:250; letter-spacing:-1.4px; line-height:1;
  text-shadow:0 4px 26px rgba(0,0,0,.4); }
.date { font-size:10px; font-weight:400; letter-spacing:2.2px; text-transform:uppercase;
  color:var(--dim); margin-top:4px; }

.pills { display:flex; flex-wrap:wrap; gap:6px; }
.pill {
  display:inline-flex; align-items:center; gap:5px; padding:4px 10px 4px 7px;
  border-radius:999px; cursor:pointer; color:var(--txt); font:500 11.5px inherit;
  background:var(--glass); border:1px solid var(--brd);
  backdrop-filter:blur(20px) saturate(150%); -webkit-backdrop-filter:blur(20px) saturate(150%);
  transition:all .16s ease;
}
.pill:hover { background:rgba(255,255,255,.14); }
.pill ha-icon { --mdc-icon-size:14px; color:var(--dim); transition:color .16s ease; }
.pill.active ha-icon { color:var(--accent); filter:drop-shadow(0 0 5px var(--accent)); }

/* ---------- onglets ---------- */
.tabbar {
  display:flex; flex-wrap:wrap; gap:4px; margin-bottom:clamp(9px,1cqw,13px);
  padding:3px; border-radius:999px; align-self:flex-start;
  background:rgba(255,255,255,.05); border:1px solid var(--brd);
  backdrop-filter:blur(20px) saturate(150%); -webkit-backdrop-filter:blur(20px) saturate(150%);
}
.tab {
  display:inline-flex; align-items:center; gap:6px; padding:6px 13px;
  border-radius:999px; cursor:pointer; border:1px solid transparent;
  background:transparent; color:var(--dim); font:600 12px inherit; letter-spacing:.2px;
  transition:all .18s ease;
}
.tab ha-icon { --mdc-icon-size:15px; }
.tab:hover { color:var(--txt); background:rgba(255,255,255,.07); }
.tab.active { color:#0a1628; background:#fff; border-color:#fff; box-shadow:0 3px 14px rgba(0,0,0,.28); }
.tab.active ha-icon { color:var(--accent); }

/* ---------- sections ---------- */
.page { display:flex; flex-direction:column; }
.section { display:flex; flex-direction:column; }
.section + .section { margin-top:clamp(14px,1.5cqw,22px); }
.sechead { display:flex; align-items:center; gap:8px; margin:0 3px 8px; }
.sechead ha-icon { --mdc-icon-size:13px; color:var(--accent); flex:0 0 auto;
  filter:drop-shadow(0 0 5px color-mix(in srgb, var(--accent) 60%, transparent)); }
.sectitle { font:700 10px inherit; letter-spacing:1.5px; text-transform:uppercase;
  color:rgba(242,247,255,.62); white-space:nowrap; }
.secline { flex:1 1 auto; height:1px;
  background:linear-gradient(90deg, rgba(255,255,255,.16), rgba(255,255,255,0)); }

/* ---------- grille ----------
   Flexbox et non CSS Grid : avec flex-grow, la derniere ligne s'etire pour
   remplir la largeur. Une grille a colonnes fixes laissait un trou a droite
   des que le nombre de tuiles ne tombait pas juste. */
.grid { display:flex; flex-wrap:wrap; gap:clamp(7px,.7cqw,10px); align-content:flex-start; }

.tile {
  flex:var(--g,1) 1 var(--b,152px); min-width:0; min-height:76px;
  position:relative; display:flex; flex-direction:column; gap:6px;
  align-items:center; text-align:center;
  padding:11px 12px; border-radius:15px; overflow:hidden;
  background:var(--glass); border:1px solid var(--brd);
  backdrop-filter:blur(24px) saturate(150%); -webkit-backdrop-filter:blur(24px) saturate(150%);
  box-shadow:0 5px 20px rgba(0,0,0,.22);
  transition:transform .16s ease, background .16s ease, border-color .16s ease, opacity .16s ease;
}
.tile:hover { transform:translateY(-1px); border-color:rgba(255,255,255,.24); }
.tile.clickable { cursor:pointer; }
.tile.on { border-color:color-mix(in srgb, var(--accent) 50%, transparent); }
.tile.on::after {
  content:''; position:absolute; inset:0; pointer-events:none; border-radius:15px;
  background:radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%);
}
.tile.muted { opacity:.6; }
.tile.compact { justify-content:space-between; }
.tile.missing { border-color:rgba(248,113,113,.5); }
.tile.dead { opacity:.4; }
.tile.hero { justify-content:center; }

/* entete centree : icone + nom groupes au milieu, jamais colles a gauche */
.thead { display:flex; align-items:center; justify-content:center; gap:6px;
  width:100%; padding:0 4px; position:relative; z-index:1; }
.ticon { --mdc-icon-size:16px; color:var(--dim); flex:0 0 auto; transition:color .16s ease; }
.tile.on .ticon { color:var(--accent); filter:drop-shadow(0 0 6px var(--accent)); }
.tname { font-size:11px; font-weight:600; letter-spacing:.2px; flex:0 1 auto;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
/* l'etat sort du flux et se pose en pastille de coin : il ne decale plus le nom */
.tstate { position:absolute; top:8px; right:10px; z-index:2;
  font-size:9px; color:var(--dim); white-space:nowrap; opacity:.85; }

.bigval { font-size:clamp(13px,1.15cqw,16px); font-weight:400; letter-spacing:-.2px; position:relative; z-index:1;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.heroval { font-size:clamp(21px,2.2cqw,30px); font-weight:250; letter-spacing:-1px; line-height:1;
  position:relative; z-index:1; }
.sub { font-size:10.5px; color:var(--dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  width:100%; position:relative; z-index:1; }

.row { display:flex; align-items:center; justify-content:center; gap:5px;
  width:100%; margin-top:auto; position:relative; z-index:1; }
.row.btns { flex-wrap:wrap; }

/* jauge */
.gwrap { position:relative; display:grid; place-items:center; margin-top:auto; }
.gauge { width:clamp(58px,5.2cqw,78px); aspect-ratio:1; }
.gbg { stroke:rgba(255,255,255,.10); }
.gfg { stroke:var(--accent); filter:drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 55%, transparent));
  transition:stroke-dasharray .6s cubic-bezier(.4,0,.2,1); }
.glabel { position:absolute; font-size:clamp(12px,1.1cqw,15px); font-weight:400; letter-spacing:-.3px; }

/* slider */
.slider {
  -webkit-appearance:none; appearance:none; flex:1 1 auto; height:24px; border-radius:8px;
  background:rgba(255,255,255,.10); outline:none; cursor:pointer; border:1px solid var(--brd);
}
.slider::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:18px; border-radius:5px;
  background:#fff; box-shadow:0 1px 5px rgba(0,0,0,.4); cursor:grab; }
.slider::-moz-range-thumb { width:14px; height:18px; border:none; border-radius:5px; background:#fff;
  box-shadow:0 1px 5px rgba(0,0,0,.4); cursor:grab; }

.mini, .chipbtn {
  display:inline-flex; align-items:center; justify-content:center; gap:4px;
  min-width:28px; height:26px; padding:0 8px; border-radius:8px; cursor:pointer;
  background:rgba(255,255,255,.10); border:1px solid var(--brd); color:var(--txt);
  font:500 10.5px inherit; transition:all .14s ease;
}
.mini:hover, .chipbtn:hover { background:rgba(255,255,255,.22); }
.mini ha-icon, .chipbtn ha-icon { --mdc-icon-size:15px; }
/* le bouton porte la couleur d'etat quand l'appareil tourne */
.tile.on .chipbtn {
  background:color-mix(in srgb, var(--accent) 20%, transparent);
  border-color:color-mix(in srgb, var(--accent) 55%, transparent);
}
.tile.on .chipbtn ha-icon { color:var(--accent); }

.select {
  width:100%; height:28px; padding:0 9px; border-radius:8px; cursor:pointer; margin-top:auto;
  background:rgba(255,255,255,.10); border:1px solid var(--brd); color:var(--txt);
  font:500 11.5px inherit; outline:none; position:relative; z-index:1;
}
.select option { background:#12233f; color:#fff; }

/* ---------- dock ---------- */
.dock { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; margin-top:clamp(10px,1.2cqw,16px); }
.dockchip {
  display:inline-flex; align-items:center; gap:6px; padding:5px 11px 5px 8px;
  border-radius:999px; cursor:pointer; color:var(--txt); font:500 11px inherit;
  background:var(--glass); border:1px solid var(--brd);
  backdrop-filter:blur(20px) saturate(150%); -webkit-backdrop-filter:blur(20px) saturate(150%);
  transition:all .16s ease;
}
.dockchip:hover { background:rgba(255,255,255,.16); }
.dockchip ha-icon { --mdc-icon-size:14px; color:var(--dim); }
.dockchip.active ha-icon { color:var(--accent); filter:drop-shadow(0 0 5px var(--accent)); }
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
