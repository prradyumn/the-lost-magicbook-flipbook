/* ====================================================================
   ALIGN TOOL — DEV ONLY
   --------------------------------------------------------------------
   Activate with `?align=1` in the URL. Provides a floating panel that
   lets you nudge game elements (position, size, font) live in the
   browser, jump between tutorial / game screens, and export every
   change as a JSON file you can paste back into game.js / game.css.

   REMOVE BEFORE PRODUCTION:
     1. This file (align-tool.js)
     2. The <script src="./align-tool.js"> tag in index.html
   ==================================================================== */

(function(){
  'use strict';

  /* --- 1. URL flag gate ------------------------------------------- */
  var params = new URLSearchParams(window.location.search);
  if(params.get('align') !== '1') return;

  /* --- 2. Editable element registry ------------------------------- */
  /* `perShape: true` means the element varies per shape/round (cube,
     cone, sphere, cylinder) — edits are applied INLINE on the active
     instance only, and tagged in the export with the current shape/
     round so they don't bleed onto the other shapes. */
  var TARGETS = [
    { name:'Boy character',     sel:'.gs-boy',                          props:['top','left','width','height'] },
    { name:'Girl character',    sel:'.gs-girl',                         props:['top','left','width','height'] },
    { name:'Hero shape',        sel:'.gs-cube-hero',                    props:['top','left','width','height'], perShape:true },
    { name:'Drag toy (tut.)',   sel:'.gs-cube-drag:not(.gs-game-piece)',props:['top','left','width','height'], perShape:true },
    { name:'Drag toy (sort)',   sel:'.gs-cube-drag.gs-game-piece',      props:['top','left','width','height'], perShape:true },
    { name:'Placed (tut.)',     sel:'.gs-cube-placed',                  props:['top','left','width','height'], perShape:true },
    { name:'Spawn box',         sel:'.gs-spawn-box',                    props:['top','left','width','height'] },
    { name:'Title',             sel:'.gs-title',                        props:['top','left','width','height'] },
    { name:'Boy bubble pos',    sel:'.gs-bubble.left',                  props:['top','left'] },
    { name:'Girl bubble pos',   sel:'.gs-bubble.right',                 props:['top','left'] },
    { name:'Bubble size',       sel:'.gs-bubble',                       props:['width','height'] },
    { name:'Bubble text',       sel:'.gs-bubble-text',                  props:['font-size'] },
    { name:'Tap hint',          sel:'.gs-tap-hint',                     props:['bottom','font-size'] },
    { name:"Let's Go button",   sel:'.lbd-go-btn',                      props:['right','bottom','font-size'] },
    { name:'Banner text',       sel:'.gs-banner-text',                  props:['top','left','font-size'] },
    { name:'Banner avatar',     sel:'.gs-banner-avatar',                props:['top','left','width','height'] },
    { name:'Cupboard',          sel:'.gs-cupboard',                     props:['top','left','width','height'] }
  ];

  function findTargetBySel(s){
    for(var i = 0; i < TARGETS.length; i++) if(TARGETS[i].sel === s) return TARGETS[i];
    return null;
  }
  function currentScope(){
    /* Returns the active shape's key (cube/cone/sphere/cylinder) if a
       tutorial is on screen, or "round_<N>" during the sort game,
       or "global" as a fallback. */
    if(window.GameAlign){
      var key = window.GameAlign.currentShapeKey && window.GameAlign.currentShapeKey();
      if(key) return key;
      var r = window.GameAlign.currentRound && window.GameAlign.currentRound();
      if(typeof r === 'number') return 'round_' + r;
    }
    return 'global';
  }

  /* --- 3. Override stylesheet (live edits land here) -------------- */
  var styleEl = document.createElement('style');
  styleEl.id = 'align-tool-overrides';
  document.head.appendChild(styleEl);

  var edits = {};   // { selector: { prop: '120px', ... } }
  var initialRead = {}; // captured per-selector on first edit so export
                        // shows before → after

  function applyOverrides(){
    var css = '';
    Object.keys(edits).forEach(function(sel){
      /* Skip scoped-key entries (format: "<sel> [<scope>]"). Those
         are recorded only for the export — the actual visual change
         was already applied inline on the live element. */
      if(sel.indexOf(' [') !== -1) return;
      var rules = edits[sel];
      var body = Object.keys(rules)
        .map(function(p){ return '  ' + p + ': ' + rules[p] + ' !important;'; })
        .join('\n');
      css += sel + '{\n' + body + '\n}\n';
    });
    styleEl.textContent = css;
  }

  function setEdit(sel, prop, value){
    var target = findTargetBySel(sel);
    /* For per-shape elements, write the change INLINE on the live
       element only. The CSS override approach would broadcast to all
       sibling-class instances (every shape's drag piece, hero, etc.)
       which is the bug. Inline style affects only the current shape's
       instance — on next shape-jump the element is rebuilt fresh. */
    if(target && target.perShape){
      var el = document.querySelector(sel);
      if(el) el.style.setProperty(prop, value, 'important');
      /* Scope the recorded edit so the export shows per-shape rows. */
      var scopedKey = sel + ' [' + currentScope() + ']';
      if(!edits[scopedKey]) edits[scopedKey] = {};
      if(!initialRead[scopedKey]) initialRead[scopedKey] = {};
      if(initialRead[scopedKey][prop] === undefined){
        initialRead[scopedKey][prop] = readComputed(sel, prop) || '(unset)';
      }
      edits[scopedKey][prop] = value;
      return;
    }
    /* Global elements — CSS rule injection (one rule for all). */
    if(!edits[sel]) edits[sel] = {};
    if(!initialRead[sel]) initialRead[sel] = {};
    if(initialRead[sel][prop] === undefined){
      initialRead[sel][prop] = readComputed(sel, prop) || '(unset)';
    }
    edits[sel][prop] = value;
    applyOverrides();
  }

  function readComputed(sel, prop){
    var el = document.querySelector(sel);
    if(!el) return '';
    var cs = window.getComputedStyle(el);
    return cs.getPropertyValue(prop);
  }

  function parseNumber(value){
    var m = /(-?\d+(?:\.\d+)?)/.exec(value);
    return m ? parseFloat(m[1]) : 0;
  }
  function parseUnit(value){
    var m = /[a-z%]+/i.exec(value);
    return m ? m[0] : 'px';
  }

  /* --- 4. Panel UI ------------------------------------------------- */
  var panel = document.createElement('div');
  panel.id = 'alignToolPanel';
  panel.innerHTML = (
    '<div class="at-header">' +
      '<span>ALIGN TOOL <small>?align=1</small></span>' +
      '<button class="at-collapse" type="button" title="Collapse">_</button>' +
    '</div>' +
    '<div class="at-body">' +
      '<div class="at-section">' +
        '<label class="at-label">Element</label>' +
        '<select id="atTargetSelect"></select>' +
      '</div>' +
      '<div class="at-section" id="atControls"></div>' +
      '<div class="at-section at-jumps">' +
        '<label class="at-label">Step through screens</label>' +
        '<div class="at-nav-row">' +
          '<button id="atPrev" type="button" title="Re-build current shape from screen 0">◀ Restart shape</button>' +
          '<button id="atNext" type="button" title="Advance to next tutorial screen">Next ▶</button>' +
        '</div>' +
        '<label class="at-label" style="margin-top:8px">Jump to</label>' +
        '<div class="at-jump-grid">' +
          '<button data-jump="cube"     type="button">Cube</button>' +
          '<button data-jump="cone"     type="button">Cone</button>' +
          '<button data-jump="sphere"   type="button">Sphere</button>' +
          '<button data-jump="cylinder" type="button">Cylinder</button>' +
          '<button data-jump="game"     type="button">Sort Game</button>' +
          '<button data-jump="full"     type="button">Full Run</button>' +
        '</div>' +
      '</div>' +
      '<div class="at-section at-export">' +
        '<button id="atExport"    type="button">⬇ Export JSON</button>' +
        '<button id="atClear"     type="button">Clear edits</button>' +
        '<div id="atEditCount" class="at-count">0 edits</div>' +
      '</div>' +
    '</div>'
  );
  document.body.appendChild(panel);

  /* --- 5. Styles --------------------------------------------------- */
  var css = (
    '#alignToolPanel{position:fixed;top:12px;left:12px;z-index:2147483647;' +
    'width:280px;background:rgba(18,22,34,.94);color:#fff;font:12px/1.4 ' +
    "-apple-system,system-ui,'Segoe UI',sans-serif;border:1px solid " +
    'rgba(120,200,255,.35);border-radius:8px;box-shadow:0 8px 24px ' +
    'rgba(0,0,0,.5);overflow:hidden}' +
    '#alignToolPanel.collapsed .at-body{display:none}' +
    '#alignToolPanel .at-header{display:flex;justify-content:space-between;' +
    'align-items:center;padding:8px 12px;background:rgba(120,200,255,.10);' +
    'font-weight:700;letter-spacing:1px;color:rgba(120,200,255,.95);font-size:11px}' +
    '#alignToolPanel .at-header small{font-weight:400;opacity:.6;margin-left:4px}' +
    '#alignToolPanel .at-collapse{background:transparent;border:0;color:#fff;' +
    'cursor:pointer;font-size:14px;padding:0 4px}' +
    '#alignToolPanel .at-body{padding:10px 12px}' +
    '#alignToolPanel .at-section{margin-bottom:10px}' +
    '#alignToolPanel .at-label{display:block;font-size:10px;letter-spacing:1px;' +
    'opacity:.7;text-transform:uppercase;margin-bottom:4px}' +
    '#alignToolPanel select,#alignToolPanel input{width:100%;background:' +
    'rgba(40,52,76,.9);border:1px solid rgba(120,200,255,.25);color:#fff;' +
    'padding:5px 8px;border-radius:4px;font:inherit;box-sizing:border-box}' +
    '#alignToolPanel input{font-variant-numeric:tabular-nums}' +
    '#alignToolPanel .at-row{display:flex;align-items:center;gap:6px;margin-bottom:4px}' +
    '#alignToolPanel .at-row label{flex:0 0 60px;font-size:11px;opacity:.85}' +
    '#alignToolPanel .at-row input{flex:1}' +
    '#alignToolPanel button{background:rgba(45,55,80,.9);border:1px solid ' +
    'rgba(120,200,255,.25);color:#fff;padding:6px 10px;border-radius:4px;' +
    'cursor:pointer;font:inherit;font-size:11px}' +
    '#alignToolPanel button:hover{background:rgba(60,110,170,.95);' +
    'border-color:rgba(140,220,255,.55)}' +
    '#alignToolPanel .at-nav-row{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px}' +
    '#alignToolPanel #atNext{background:linear-gradient(180deg,#4AA8E8,#2C7DC0);border-color:rgba(140,220,255,.55);font-weight:700}' +
    '#alignToolPanel .at-jump-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}' +
    '#alignToolPanel .at-export{display:flex;gap:6px;flex-wrap:wrap}' +
    '#alignToolPanel #atExport{flex:1;background:linear-gradient(180deg,#4AA8E8,#2C7DC0);' +
    'border-color:rgba(140,220,255,.55);font-weight:700}' +
    '#alignToolPanel .at-count{flex:0 0 100%;font-size:10px;opacity:.6;margin-top:4px}'
  );
  var s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);

  /* --- 6. Populate dropdown + controls ----------------------------- */
  var sel = panel.querySelector('#atTargetSelect');
  TARGETS.forEach(function(t, i){
    var opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = t.name + ' (' + t.sel + ')';
    sel.appendChild(opt);
  });
  sel.addEventListener('change', function(){ renderControls(parseInt(sel.value, 10)); });
  renderControls(0);

  function renderControls(targetIdx){
    var t = TARGETS[targetIdx];
    var holder = panel.querySelector('#atControls');
    holder.innerHTML = '';
    /* Show current scope on per-shape rows so the user knows their
       edits will be tagged to (e.g.) the cylinder, not cube. */
    if(t.perShape){
      var hint = document.createElement('div');
      hint.style.cssText = 'font-size:10px;opacity:.7;margin-bottom:4px;color:rgba(150,255,190,.9);';
      hint.textContent = 'Scope: ' + currentScope() + ' (edit applies only to this shape/round)';
      holder.appendChild(hint);
    }
    t.props.forEach(function(prop){
      var row = document.createElement('div');
      row.className = 'at-row';
      var lbl = document.createElement('label');
      lbl.textContent = prop;
      var inp = document.createElement('input');
      inp.type = 'text';
      var scopedKey = t.perShape ? (t.sel + ' [' + currentScope() + ']') : t.sel;
      var existing = edits[scopedKey] && edits[scopedKey][prop];
      inp.value = existing || readComputed(t.sel, prop) || '';
      inp.addEventListener('change', function(){
        var v = inp.value.trim();
        if(!v) return;
        /* Auto-append "px" if user typed a bare number */
        if(/^-?\d+(\.\d+)?$/.test(v)) v += 'px';
        setEdit(t.sel, prop, v);
        updateCount();
      });
      /* Arrow keys nudge by 1 (or 10 with shift) */
      inp.addEventListener('keydown', function(e){
        if(e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        var n = parseNumber(inp.value);
        var u = parseUnit(inp.value);
        var step = e.shiftKey ? 10 : 1;
        n += (e.key === 'ArrowUp' ? step : -step);
        inp.value = n + u;
        setEdit(t.sel, prop, inp.value);
        updateCount();
        e.preventDefault();
      });
      row.appendChild(lbl);
      row.appendChild(inp);
      holder.appendChild(row);
    });
  }

  /* --- 7. Page jumps ----------------------------------------------- */
  panel.addEventListener('click', function(e){
    var btn = e.target.closest('button[data-jump]');
    if(!btn) return;
    var mode = btn.getAttribute('data-jump');
    _lastJump = mode;
    if(typeof window.startShapeGames !== 'function'){
      alert('startShapeGames not loaded yet — wait a moment and retry');
      return;
    }
    /* Hide flipbook UI behind the game overlay. */
    var bs = document.querySelector('.book-scene');     if(bs) bs.style.display = 'none';
    var pc = document.getElementById('pgCnt');          if(pc) pc.style.display = 'none';
    var pl = document.getElementById('preloader');      if(pl) pl.style.display = 'none';
    var queue;
    switch(mode){
      case 'cube':     queue = ['cube']; break;
      case 'cone':     queue = ['cone']; break;
      case 'sphere':   queue = ['sphere']; break;
      case 'cylinder': queue = ['cylinder']; break;
      case 'game':     queue = ['game']; break;
      default:         queue = ['cube','cone','sphere','cylinder','game'];
    }
    /* Unlock audio (this click is the user gesture). */
    try{ if(window.unlockGameAudio) window.unlockGameAudio(); }catch(err){}
    window.startShapeGames(queue, function(){ console.log('[align] jump finished'); });
  });

  /* --- 8. Export / clear ------------------------------------------- */
  panel.querySelector('#atExport').addEventListener('click', function(){
    var payload = {
      exportedAt: new Date().toISOString(),
      changeCount: countEdits(),
      changes: buildExportShape()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'align-edits-' + Date.now() + '.json';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  });
  panel.querySelector('#atClear').addEventListener('click', function(){
    if(!confirm('Clear all align edits? This wipes the override stylesheet.')) return;
    edits = {};
    initialRead = {};
    applyOverrides();
    renderControls(parseInt(sel.value, 10));
    updateCount();
  });

  function buildExportShape(){
    /* { selector: { prop: { from, to } } } */
    var out = {};
    Object.keys(edits).forEach(function(s){
      out[s] = {};
      Object.keys(edits[s]).forEach(function(p){
        out[s][p] = {
          from: (initialRead[s] && initialRead[s][p]) || null,
          to:   edits[s][p]
        };
      });
    });
    return out;
  }
  function countEdits(){
    var n = 0;
    Object.keys(edits).forEach(function(s){ n += Object.keys(edits[s]).length; });
    return n;
  }
  function updateCount(){
    panel.querySelector('#atEditCount').textContent = countEdits() + ' edits';
  }

  /* --- 8b. Next / Restart screen navigation ------------------------ */
  /* The dialogue screens use a full-stage .gs-clickcatcher div whose
     pointerdown handler calls game.js's internal nextScreen(). Align
     mode kills the catcher's pointer-events globally, so we
     synthesise a pointerdown after temporarily restoring them. */
  function advanceScreen(){
    /* 1. Dialogue screens — use the existing click-catcher path. */
    var catcher = document.querySelector('.gs-clickcatcher');
    if(catcher){
      catcher.style.pointerEvents = 'auto';
      var ev = new PointerEvent('pointerdown', { bubbles:true, cancelable:true });
      catcher.dispatchEvent(ev);
      setTimeout(function(){ catcher.style.pointerEvents = ''; }, 50);
      return;
    }

    /* 2. Other screens — fall back to game.js's exposed GameAlign API. */
    if(!window.GameAlign){
      console.warn('[align] GameAlign API not available. Make sure ?align=1 is in the URL when game.js loaded.');
      return;
    }
    var GA = window.GameAlign;

    /* Detect current phase by inspecting the DOM. */
    var hasPlayAgain = !!document.querySelector('.gs-play-again-btn');
    var hasGamePiece = !!document.querySelector('.gs-cube-drag.gs-game-piece');
    var hasTutDrag   = !!document.querySelector('.gs-cube-drag:not(.gs-game-piece)');
    var hasPlaced    = !!document.querySelector('.gs-cube-placed');
    var hasSpawnBox  = !!document.querySelector('.gs-spawn-box');

    if(hasPlayAgain){
      /* Celebration — wrap around to first round. */
      GA.gotoRound(0);
    } else if(hasGamePiece || hasSpawnBox){
      /* Sort-game round — advance to next round. */
      GA.nextRound();
    } else if(hasPlaced){
      /* Tutorial success — close → playNextShape → next tutorial. */
      GA.close();
    } else if(hasTutDrag){
      /* Tutorial drag screen — jump to success screen for this shape. */
      GA.buildSuccessScreen();
    } else {
      console.warn('[align] Unknown screen state — use a Jump button to recover.');
    }
  }

  /* "Restart shape" — re-trigger the most recent Jump button so the
     current shape's screens rebuild from screen 0. */
  var _lastJump = null;
  function restartShape(){
    if(!_lastJump){
      alert('No shape jumped to yet — pick one from the Jump grid first.');
      return;
    }
    panel.querySelector('button[data-jump="' + _lastJump + '"]').click();
  }

  panel.querySelector('#atNext').addEventListener('click', advanceScreen);
  panel.querySelector('#atPrev').addEventListener('click', restartShape);

  /* --- 9. Collapse toggle ------------------------------------------ */
  panel.querySelector('.at-collapse').addEventListener('click', function(){
    panel.classList.toggle('collapsed');
  });

  /* --- 10. Drag-to-position elements directly --------------------- */
  /* Lets the user click + drag any editable game element to reposition
     it visually. Uses capture-phase pointerdown so it intercepts the
     event BEFORE the game's own drag handlers can fire, stops
     propagation, and writes the new left/top (or right/bottom) into
     the override stylesheet. */

  /* Visual outline + drag cursor for align-mode interaction.
     Also kill ALL game interactions so dialogue screens / sorting
     game don't react to taps — align mode is pure editor: navigate
     via the Next button, edit via drag. */
  var dragCss = (
    '.align-hover{outline:2px dashed rgba(120,200,255,.9)!important;' +
    'outline-offset:4px;cursor:move!important}' +
    '.align-drag{outline:3px solid rgba(120,200,255,1)!important;' +
    'outline-offset:4px;cursor:grabbing!important;' +
    'filter:brightness(1.08) drop-shadow(0 0 12px rgba(120,200,255,.6))}' +
    /* Suppress game interactions: click-catchers, the LBD intro
       button (manually navigated), Play Again, and the drag piece's
       native pointer behaviour. All still visible — just not
       receiving pointer events through them. The align tool itself
       listens at document/capture so it picks up clicks below. */
    '.gs-clickcatcher,.lbd-go-btn,.gs-play-again-btn{pointer-events:none!important}'
  );
  var ds = document.createElement('style');
  ds.textContent = dragCss;
  document.head.appendChild(ds);

  var STAGE_W = 1920, STAGE_H = 1080;
  function getStage(){ return document.getElementById('gameStage'); }
  function getStageRect(){
    var s = getStage();
    if(s){
      var r = s.getBoundingClientRect();
      return { left:r.left, top:r.top, width:r.width, height:r.height, scale: r.width/STAGE_W };
    }
    /* Fallback when overlay not visible — use viewport. */
    return { left:0, top:0, width:window.innerWidth, height:window.innerHeight,
             scale: window.innerWidth/STAGE_W };
  }

  /* Find the TARGET entry whose selector matches the element OR an
     editable element under the cursor (peers through click-catchers,
     overlays, etc. using elementsFromPoint). */
  function findTargetFor(el){
    if(!el || !el.closest) return null;
    for(var i = 0; i < TARGETS.length; i++){
      var t = TARGETS[i];
      if(el.closest(t.sel)){
        var hasPos = t.props.some(function(p){
          return p === 'left' || p === 'top' ||
                 p === 'right' || p === 'bottom';
        });
        if(hasPos) return t;
      }
    }
    return null;
  }
  function findTargetAtPoint(x, y){
    if(!document.elementsFromPoint) return null;
    var els = document.elementsFromPoint(x, y);
    for(var i = 0; i < els.length; i++){
      if(els[i].closest && els[i].closest('#alignToolPanel')) return null;
      var t = findTargetFor(els[i]);
      if(t) return t;
    }
    return null;
  }

  var hoveredEl = null;
  var dragging  = null;

  document.addEventListener('pointermove', function(e){
    if(dragging) return;
    var t = findTargetAtPoint(e.clientX, e.clientY);
    var el = t && document.querySelector(t.sel);
    if(el !== hoveredEl){
      if(hoveredEl) hoveredEl.classList.remove('align-hover');
      hoveredEl = el || null;
      if(hoveredEl) hoveredEl.classList.add('align-hover');
    }
  }, true);

  document.addEventListener('pointerdown', function(e){
    /* Don't hijack clicks inside the align panel itself. */
    if(e.target.closest && e.target.closest('#alignToolPanel')) return;
    var t = findTargetAtPoint(e.clientX, e.clientY);
    if(!t) return;
    var el = document.querySelector(t.sel);
    if(!el) return;

    /* Block game's own drag handlers in the capture phase. */
    e.preventDefault();
    e.stopPropagation();

    var sr = getStageRect();
    var er = el.getBoundingClientRect();
    var elLeft = (er.left - sr.left) / sr.scale;
    var elTop  = (er.top  - sr.top)  / sr.scale;
    var px     = (e.clientX - sr.left) / sr.scale;
    var py     = (e.clientY - sr.top)  / sr.scale;

    dragging = {
      target: t,
      el:     el,
      offX:   px - elLeft,
      offY:   py - elTop,
      elW:    er.width  / sr.scale,
      elH:    er.height / sr.scale
    };
    el.classList.add('align-drag');
    if(hoveredEl){ hoveredEl.classList.remove('align-hover'); hoveredEl = null; }

    /* Auto-select the dragged target in the dropdown. */
    var idx = TARGETS.indexOf(t);
    sel.value = String(idx);
    renderControls(idx);
  }, true);

  document.addEventListener('pointermove', function(e){
    if(!dragging) return;
    e.preventDefault();
    var sr = getStageRect();
    var px = (e.clientX - sr.left) / sr.scale;
    var py = (e.clientY - sr.top)  / sr.scale;
    var newLeft = Math.round(px - dragging.offX);
    var newTop  = Math.round(py - dragging.offY);

    var props = dragging.target.props;
    /* Horizontal */
    if(props.indexOf('left') !== -1){
      setEdit(dragging.target.sel, 'left', newLeft + 'px');
    } else if(props.indexOf('right') !== -1){
      var rightVal = Math.round(STAGE_W - newLeft - dragging.elW);
      setEdit(dragging.target.sel, 'right', rightVal + 'px');
    }
    /* Vertical */
    if(props.indexOf('top') !== -1){
      setEdit(dragging.target.sel, 'top', newTop + 'px');
    } else if(props.indexOf('bottom') !== -1){
      var bottomVal = Math.round(STAGE_H - newTop - dragging.elH);
      setEdit(dragging.target.sel, 'bottom', bottomVal + 'px');
    }

    var idx = TARGETS.indexOf(dragging.target);
    renderControls(idx);
    updateCount();
  }, true);

  function endDrag(){
    if(!dragging) return;
    dragging.el.classList.remove('align-drag');
    dragging = null;
  }
  document.addEventListener('pointerup',     endDrag, true);
  document.addEventListener('pointercancel', endDrag, true);

  console.log('[align] panel ready. Use ?align=1 to enable, ?align=0 to remove URL flag.');
  console.log('[align] Hover game elements for a dashed outline, click+drag to move them.');
})();
