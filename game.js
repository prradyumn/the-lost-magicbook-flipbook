/* ======================================================================
   Shape Tutorial Game
   N-screen, multi-shape sequence that plays between flipbook page 4
   and page 5. No VOs (per spec) — uses tap-to-advance + on-screen text.
   Shapes are configured in SHAPES below; queue them in any order.
   ====================================================================== */
(function(){
  'use strict';

  var ASSETS  = './assets%20game/';
  var STAGE_W = 1920;
  var STAGE_H = 1080;

  /* Resolve an asset filename. If the name already begins with ./ ../ or /
     it's treated as a path relative to the HTML page (so files in the
     project root are reachable). Otherwise it's resolved as a filename in
     the shared "assets game" folder. */
  function resolveAsset(name){
    if(!name) return '';
    if(name.charAt(0) === '/' ||
       name.indexOf('./')  === 0 ||
       name.indexOf('../') === 0){
      return name;
    }
    return ASSETS + encodeURI(name);
  }

  /* ------------------------------------------------------------------ */
  /*  Per-shape configuration                                            */
  /*  - hero/drag/placed/target are stage-local rects (top-left, w, h)   */
  /*  - nudge.dx/dy = pixels the hand cursor travels per loop            */
  /*  - png === null → no static PNG provided; static slots fall back    */
  /*    to a non-rotating GLB (visually = a 3D rendering)                */
  /*  - titlePng === null → render styled text using titleText           */
  /* ------------------------------------------------------------------ */
  var SHAPES = {
    cube: {
      glb:       'ToyBlock_ABC.glb',
      png:       'block (1).png',
      titlePng:  'Group 422.png',         /* "Cube" yellow title */
      titleText: 'Cube',
      hero:   { x:708.35, y:532.21, w:503.30, h:503.30 },
      drag:   { x:178.47, y:492.99, w:278.65, h:278.65 },
      /* Figma slide-100 cupboard@322 → block at (714, 852, 200x200);
         we run with cupboard@582, so shift x by +260. */
      placed: { x:974,    y:852,    w:200,    h:200 },
      target: { x:616.04, y:830.35, w:1220.45, h:218.55 },    /* bottom row */
      nudge:  { x:198.68, y:532.20, dx: 580, dy:  300 },
      dialogues:[
        { speaker:'boy',  text:'I found a block.',              showTitle:false },
        { speaker:'girl', text:'This shape is called a CUBE.',  showTitle:true  },
        { speaker:'girl', text:'Let us place it on the shelf.', showTitle:true  }
      ]
    },
    cone: {
      glb:       'PartyHat.glb',
      png:       './cap.png',             /* party-hat PNG in project root  */
      titlePng:  '421.png',               /* "Cone" yellow title            */
      titleText: 'Cone',
      hero:   { x:787.72, y:444.17, w:391.16, h:586.74 },
      drag:   { x:201.90, y:445.32, w:227.82, h:341.73 },
      /* Figma slide-100 cap (party hat) at (749, 266, 133x200); +260 shift. */
      placed: { x:1009,   y:266,    w:133,    h:200 },
      target: { x:616.04, y:238.35, w:1220.45, h:218.55 },    /* top row    */
      nudge:  { x:180.65, y:570.83, dx: 620, dy: -280 },
      dialogues:[
        { speaker:'boy',  text:'Look, Aany found this hat!',    showTitle:false },
        { speaker:'girl', text:'This shape is called a CONE.',  showTitle:true  },
        { speaker:'girl', text:'Let us place it on the shelf.', showTitle:true  }
      ]
    },
    sphere: {
      glb:       'SoccerBall.glb',
      png:       'image (18).png',
      titlePng:  '423.png',               /* "Sphere" yellow title */
      titleText: 'Sphere',
      /* Sphere is symmetric — square bounds for all three slots. */
      hero:   { x:790.00, y:490.00, w:390.00, h:390.00 },
      drag:   { x:190.00, y:490.00, w:260.00, h:260.00 },
      /* Figma slide-100 football at (726, 466, 180x180); +260 shift. */
      placed: { x:986,    y:466,    w:180,    h:180 },
      target: { x:616.04, y:435.68, w:1220.45, h:218.55 },    /* row 2      */
      nudge:  { x:210.00, y:530.00, dx: 600, dy:  -40 },
      dialogues:[
        { speaker:'girl', text:'Look, your favourite toy!',      showTitle:false },
        { speaker:'boy',  text:'Yes! A ball!',                   showTitle:false },
        { speaker:'girl', text:'This shape is called a SPHERE.', showTitle:true  },
        { speaker:'girl', text:'Let us place it on the shelf.',  showTitle:true  }
      ]
    },
    cylinder: {
      glb:       'ToyDrum.glb',
      png:       'ChatGPT Image Dec 29, 2025, 01_55_04 PM 1.png',
      titlePng:  '420.png',               /* "Cylinder" yellow title */
      titleText: 'Cylinder',
      /* Drum is roughly square — same bounds for all three slots. */
      hero:   { x:770.00, y:480.00, w:400.00, h:400.00 },
      drag:   { x:180.00, y:490.00, w:260.00, h:260.00 },
      /* Figma slide-100 drum at (719, 664, 192x192); +260 shift. */
      placed: { x:979,    y:664,    w:192,    h:192 },
      target: { x:616.04, y:633.01, w:1220.45, h:218.55 },    /* row 3      */
      nudge:  { x:200.00, y:530.00, dx: 600, dy:  140 },
      dialogues:[
        { speaker:'girl', text:'A drum!',                          showTitle:false },
        { speaker:'boy',  text:'I know this one!',                 showTitle:false },
        { speaker:'girl', text:'This shape is called a CYLINDER.', showTitle:true  },
        { speaker:'girl', text:'Let us place it on the shelf.',    showTitle:true  }
      ]
    }
  };

  var overlay, stage;
  var currentShape  = null;
  var currentScreen = 0;
  var onComplete    = null;
  var queue         = [];
  var wrongAttempts = 0;
  /* Cumulative list of shapes already placed in the cupboard during this
     session — re-rendered on every subsequent shape's drag/success screen
     so the cupboard stays populated as the tutorials progress. */
  var placedShapes  = [];

  /* "Ting" sound played whenever the user taps to advance a dialogue
     (or taps the floating shape). One Audio instance is kept around;
     each play clones it so overlapping taps still chime. */
  var TING_SRC = './audio/u_vfd6lcdzng-ting-sound-197759.mp3';
  var tingAudio = null;
  function playTing(){
    try{
      if(!tingAudio){
        tingAudio = new Audio(TING_SRC);
        tingAudio.preload = 'auto';
        tingAudio.volume = 0.9;
      }
      var s = tingAudio.cloneNode();
      s.volume = 0.9;
      var p = s.play();
      if(p && p.catch) p.catch(function(){});
    }catch(e){}
  }

  /* Big celebratory chime played once when the whole sorting game ends.
     Uses the custom asset shipped at `assets game/sucess chime.mp3`. */
  var SUCCESS_SRC = './assets%20game/sucess%20chime.mp3';
  var successAudio = null;
  function playSuccessChime(){
    try{
      if(!successAudio){
        successAudio = new Audio(SUCCESS_SRC);
        successAudio.preload = 'auto';
        successAudio.volume = 1.0;
      }
      var s = successAudio.cloneNode();
      s.volume = 1.0;
      var p = s.play();
      if(p && p.catch) p.catch(function(){});
    }catch(e){}
  }

  /* ------------------------------------------------------------------ */
  /*  SFX (WebAudio synth — placeholder until real mp3s are dropped in)  */
  /*  To replace with real audio: swap each sfxX function body to play   */
  /*  an Audio() of the corresponding file (similar to playTing above).  */
  /* ------------------------------------------------------------------ */
  var _sfxCtx = null;
  function _getSfxCtx(){
    try{
      if(!_sfxCtx){
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if(!Ctx) return null;
        _sfxCtx = new Ctx();
      }
      if(_sfxCtx.state === 'suspended'){ try{ _sfxCtx.resume(); }catch(e){} }
      return _sfxCtx;
    }catch(e){ return null; }
  }
  /* Pickup — short upward chirp when the user grabs a toy. */
  function sfxPickup(){
    var ctx = _getSfxCtx(); if(!ctx) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(960, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.20);
  }
  /* Drop — soft thud when the user releases on a NEUTRAL spot (no
     correct/wrong follow-up — used for general drag release feel). */
  function sfxDrop(){
    var ctx = _getSfxCtx(); if(!ctx) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.10);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.15);
  }
  /* Correct — bright cheerful 3-note rising chime (E-G-C). */
  function sfxCorrect(){
    var ctx = _getSfxCtx(); if(!ctx) return;
    var t0 = ctx.currentTime;
    [659.25, 783.99, 1046.50].forEach(function(freq, i){
      var t = t0 + i * 0.07;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.60);
    });
  }
  /* Wrong — descending square-wave buzz for an incorrect drop. */
  function sfxWrong(){
    var ctx = _getSfxCtx(); if(!ctx) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(95, t + 0.28);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.34);
  }

  /* ------------------------------------------------------------------ */
  /*  Mobile audio unlock                                                */
  /*  Must be called from a real user gesture (first Start click).       */
  /*  Resumes the WebAudio context AND silently touches every Audio()    */
  /*  path so the browser whitelists each one for later plays.           */
  /* ------------------------------------------------------------------ */
  var _audioUnlocked = false;
  function unlockAllAudio(){
    if(_audioUnlocked) return;
    _audioUnlocked = true;

    /* Resume the WebAudio context that drives our synth SFX. */
    try{
      var ctx = _getSfxCtx();
      if(ctx && ctx.state === 'suspended'){ ctx.resume(); }
    }catch(e){}

    /* Spawn a throw-away muted Audio() for each file we'll later play.
       The browser links the gesture to the URL, so subsequent
       `new Audio(url).play()` calls succeed without re-gesture. */
    var paths = [
      './audio/u_vfd6lcdzng-ting-sound-197759.mp3',
      './assets%20game/sucess%20chime.mp3',
      './page.mp3',
      './bg%20music.mp3'
    ];
    paths.forEach(function(src){
      try{
        var a = new Audio(src);
        a.muted = true;
        a.volume = 0;
        var p = a.play();
        if(p && p.catch) p.catch(function(){});
        setTimeout(function(){
          try{ a.pause(); a.currentTime = 0; }catch(e){}
        }, 60);
      }catch(e){}
    });
  }
  /* Expose so script.js can invoke from the Start-button gesture. */
  window.unlockGameAudio = unlockAllAudio;

  /* ------------------------------------------------------------------ */
  /*  Bootstrap                                                          */
  /* ------------------------------------------------------------------ */
  function init(){
    overlay = document.getElementById('gameOverlay');
    if(!overlay) return;
    stage = document.getElementById('gameStage');
    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
  }

  /* Landscape: COVER — stage scales to fill the viewport completely,
     extreme-aspect edges may be clipped by overlay's overflow:hidden.
     Portrait: CONTAIN — stage fits with bands rather than clipping half
     the design. Recomputed on every resize / orientation change. */
  function updateScale(){
    var sx = window.innerWidth  / STAGE_W;
    var sy = window.innerHeight / STAGE_H;
    var s = (window.innerWidth >= window.innerHeight)
      ? Math.max(sx, sy)
      : Math.min(sx, sy);
    document.documentElement.style.setProperty('--game-scale', s.toFixed(4));
  }

  /* ------------------------------------------------------------------ */
  /*  Element helpers                                                    */
  /* ------------------------------------------------------------------ */
  function clearStage(){ stage.innerHTML = ''; }

  function addImg(file, cls){
    var el = document.createElement('img');
    el.src = ASSETS + encodeURI(file);
    el.className = cls;
    el.draggable = false;
    el.alt = '';
    stage.appendChild(el);
    return el;
  }

  function addDiv(cls){
    var el = document.createElement('div');
    el.className = cls;
    stage.appendChild(el);
    return el;
  }

  function applyRect(el, r){
    el.style.left   = r.x + 'px';
    el.style.top    = r.y + 'px';
    el.style.width  = r.w + 'px';
    el.style.height = r.h + 'px';
  }

  /* SVG silhouette used by the drag-screen target outline.
     Each shape uses a 100x100 viewBox normalized into the placed rect
     so the outline scales with the toy's footprint. preserveAspectRatio
     is "none" so rectangular footprints (e.g. cone 133x200) stretch
     the silhouette to match. */
  function targetSilhouetteSvg(key){
    var head = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">';
    var tail = '</svg>';
    switch(key){
      case 'cube':
        return head +
          '<rect class="shape" x="12" y="12" width="76" height="76" rx="8" ry="8"/>' +
          tail;
      case 'sphere':
        return head +
          '<circle class="shape" cx="50" cy="50" r="40"/>' +
          tail;
      case 'cone':
        return head +
          '<polygon class="shape" points="50,14 86,86 14,86"/>' +
          tail;
      case 'cylinder':
        /* Drum/cylinder silhouette: curved top + bottom edges so the
           outline reads as a 3D cylinder without poking past the rect. */
        return head +
          '<path class="shape" d="M 14 26 Q 50 14 86 26 L 86 74 Q 50 86 14 74 Z"/>' +
          tail;
      default:
        return head +
          '<rect class="shape" x="12" y="12" width="76" height="76" rx="8"/>' +
          tail;
    }
  }

  /* Render all previously-placed shapes statically on the cupboard.
     Skips the current shape (its drag/placed piece is rendered separately
     with its own pop / glow animations). */
  function renderPersistentPlacements(){
    for(var i = 0; i < placedShapes.length; i++){
      var p = placedShapes[i];
      var el = addDiv('gs-placed-static');
      applyRect(el, p.placed);
      var img = document.createElement('img');
      img.src = resolveAsset(p.png);
      img.draggable = false;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none;';
      el.appendChild(img);
    }
  }

  /* Floating hero shape — auto-rotating GLB with poster fallback. */
  function makeShapeViewer(){
    var mv = document.createElement('model-viewer');
    mv.setAttribute('src', resolveAsset(currentShape.glb));
    mv.setAttribute('alt', 'Toy shape');
    mv.setAttribute('auto-rotate', '');
    mv.setAttribute('rotation-per-second', '55deg');
    mv.setAttribute('auto-rotate-delay', '0');
    mv.setAttribute('disable-zoom', '');
    mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('shadow-intensity', '0');
    mv.setAttribute('exposure', '1.15');
    mv.setAttribute('environment-image', 'neutral');
    mv.style.cssText =
      'width:100%;height:100%;display:block;background:transparent;' +
      'pointer-events:none;border:none;outline:none;' +
      '--poster-color:transparent;' +
      '--progress-bar-color:transparent;' +
      '--progress-bar-height:0px;';

    /* No <img slot="poster"> here — we used to add the shape PNG as a
       loading fallback, but on every dialogue screen rebuild it would
       flash for a frame before the GLB rendered. Dialogue screens must
       show only the 3D model; the PNG is reserved for drag/placed. */
    return mv;
  }

  /* Drag / placed shape — PNG if provided, else a static (non-rotating)
     GLB so it visually matches the hero pose. */
  function makeShapeStatic(){
    if(currentShape.png){
      var img = document.createElement('img');
      img.src = resolveAsset(currentShape.png);
      img.draggable = false;
      img.alt = '';
      img.style.cssText =
        'width:100%;height:100%;object-fit:contain;' +
        'user-select:none;-webkit-user-drag:none;pointer-events:none;';
      return img;
    }
    var mv = makeShapeViewer();
    mv.removeAttribute('auto-rotate');
    return mv;
  }

  /* ------------------------------------------------------------------ */
  /*  Screen builders                                                    */
  /* ------------------------------------------------------------------ */

  /* Screens 1-3: characters + hero shape + speech bubble */
  function buildDialogue(idx){
    var d = currentShape.dialogues[idx];
    clearStage();

    addImg('blur black.png', 'gs-blur');
    /* Decorative spotlight halo behind the hero shape — exact Figma
       asset + position. */
    addImg('glow.png', 'gs-spotlight');
    addImg('ChatGPT Image Dec 26, 2025, 01_22_06 PM 1.png', 'gs-boy');
    addImg('ChatGPT Image Dec 26, 2025, 01_22_06 PM 2.png', 'gs-girl');

    /* Hero — auto-rotating 3D GLB */
    var hero = addDiv('gs-cube-hero');
    applyRect(hero, currentShape.hero);
    hero.appendChild(makeShapeViewer());

    /* Shape title — visibility set per-dialogue (showTitle flag) */
    if(d.showTitle){
      if(currentShape.titlePng){
        var tPng = addDiv('gs-title');
        var tImg = document.createElement('img');
        tImg.src = resolveAsset(currentShape.titlePng);
        tImg.draggable = false;
        tPng.appendChild(tImg);
      } else {
        var tTxt = addDiv('gs-title gs-title-text');
        tTxt.textContent = currentShape.titleText;
      }
    }

    /* Speech bubble */
    var b = addDiv('gs-bubble ' + (d.speaker === 'boy' ? 'left' : 'right'));
    var bBg = document.createElement('img');
    bBg.className = 'gs-bubble-bg';
    bBg.src = ASSETS + encodeURI('Vector.png');
    bBg.draggable = false;
    bBg.alt = '';
    b.appendChild(bBg);
    var bTxt = document.createElement('div');
    bTxt.className = 'gs-bubble-text';
    bTxt.textContent = d.text;
    b.appendChild(bTxt);

    /* Tap-to-advance — plays the ting sound on every tap. */
    var catcher = addDiv('gs-clickcatcher');
    var hint    = addDiv('gs-tap-hint');
    hint.textContent = 'Tap to continue';
    setTimeout(function(){
      catcher.addEventListener('pointerdown', function(){
        playTing();
        nextScreen();
      }, { once:true });
    }, 500);
  }

  /* Screen 4 — drag to correct shelf row */
  function buildDragScreen(){
    clearStage();
    wrongAttempts = 0;

    addImg('blur black.png',    'gs-blur');
    addImg('full cupboard.png', 'gs-cupboard');

    /* Re-render shapes placed in earlier tutorials so the cupboard
       stays populated as the player progresses. */
    renderPersistentPlacements();

    /* Shape-matched dashed outline at the exact landing spot. The
       full row still acts as the drop hit-zone for forgiveness, but
       the visual cue is now a silhouette of the shape itself. */
    var target = addDiv('gs-target-zone gs-target-' + currentShape._key);
    applyRect(target, currentShape.placed);
    target.innerHTML = targetSilhouetteSvg(currentShape._key);

    /* Top banner + text */
    addImg('Question template.png', 'gs-banner');
    var bt = addDiv('gs-banner-text');
    bt.textContent = 'Drag this toy to the correct shelf.';

    /* Pickup frame around drag-start */
    addImg('Group 23.png', 'gs-banner-avatar');

    /* Draggable shape */
    var piece = addDiv('gs-cube-drag');
    applyRect(piece, currentShape.drag);
    piece.appendChild(makeShapeStatic());

    /* Animated hand nudge */
    var nudge = addImg('Swipe Up And Click 7.png', 'gs-hand-nudge');
    nudge.style.left = currentShape.nudge.x + 'px';
    nudge.style.top  = currentShape.nudge.y + 'px';
    nudge.style.setProperty('--hand-dx', currentShape.nudge.dx + 'px');
    nudge.style.setProperty('--hand-dy', currentShape.nudge.dy + 'px');

    setupDrag(piece, target, nudge);
  }

  /* Screen 5 — success */
  function buildSuccessScreen(){
    clearStage();

    addImg('blur black.png',    'gs-blur');
    addImg('full cupboard.png', 'gs-cupboard');

    /* Render shapes placed in earlier tutorials, then the just-placed
       one on top with its pop-in animation. */
    renderPersistentPlacements();

    addImg('Question template.png', 'gs-banner');
    var bt = addDiv('gs-banner-text');
    bt.textContent = 'Well done!';

    var placed = addDiv('gs-cube-placed');
    applyRect(placed, currentShape.placed);
    placed.appendChild(makeShapeStatic());

    /* Auto-advance: next shape, or fade out and call onComplete */
    setTimeout(close, 2200);
  }

  /* ------------------------------------------------------------------ */
  /*  Drag-and-drop                                                      */
  /* ------------------------------------------------------------------ */
  function setupDrag(piece, target, nudge){
    var dragging = false;
    var offX = 0, offY = 0;
    var stageRect, scale;

    function toStage(clientX, clientY){
      stageRect = stage.getBoundingClientRect();
      scale = stageRect.width / STAGE_W;
      return {
        x: (clientX - stageRect.left) / scale,
        y: (clientY - stageRect.top)  / scale
      };
    }

    function onDown(e){
      e.preventDefault();
      dragging = true;
      piece.classList.add('dragging');
      if(nudge) nudge.style.display = 'none';
      sfxPickup();

      var p = toStage(e.clientX, e.clientY);
      var rect = piece.getBoundingClientRect();
      var pieceLeft = (rect.left - stageRect.left) / scale;
      var pieceTop  = (rect.top  - stageRect.top)  / scale;
      offX = p.x - pieceLeft;
      offY = p.y - pieceTop;

      window.addEventListener('pointermove',   onMove);
      window.addEventListener('pointerup',     onUp);
      window.addEventListener('pointercancel', onUp);
    }

    function onMove(e){
      if(!dragging) return;
      var p = toStage(e.clientX, e.clientY);
      piece.style.left = (p.x - offX) + 'px';
      piece.style.top  = (p.y - offY) + 'px';
    }

    function onUp(){
      if(!dragging) return;
      dragging = false;
      piece.classList.remove('dragging');
      window.removeEventListener('pointermove',   onMove);
      window.removeEventListener('pointerup',     onUp);
      window.removeEventListener('pointercancel', onUp);

      var rect = piece.getBoundingClientRect();
      var cx = (rect.left + rect.width / 2  - stageRect.left) / scale;
      var cy = (rect.top  + rect.height / 2 - stageRect.top)  / scale;
      var t  = currentShape.target;

      var inside = (cx >= t.x && cx <= t.x + t.w &&
                    cy >= t.y && cy <= t.y + t.h);

      if(inside){
        piece.classList.add('correct-snap');
        target.style.opacity = '0';
        sfxCorrect();
        var p = currentShape.placed;
        piece.style.transition =
          'left .4s cubic-bezier(.34,1.56,.64,1), ' +
          'top .4s cubic-bezier(.34,1.56,.64,1), ' +
          'width .4s ease, height .4s ease';
        piece.style.left   = p.x + 'px';
        piece.style.top    = p.y + 'px';
        piece.style.width  = p.w + 'px';
        piece.style.height = p.h + 'px';
        /* Record this placement so future tutorials' cupboard shows it. */
        placedShapes.push({
          png: currentShape.png,
          placed: { x:p.x, y:p.y, w:p.w, h:p.h }
        });
        setTimeout(nextScreen, 480);
      } else {
        wrongAttempts++;
        sfxWrong();
        piece.classList.add('bounce-wrong');
        piece.style.transition =
          'left .45s cubic-bezier(.34,1.56,.64,1), ' +
          'top .45s cubic-bezier(.34,1.56,.64,1)';
        piece.style.left = currentShape.drag.x + 'px';
        piece.style.top  = currentShape.drag.y + 'px';
        setTimeout(function(){
          piece.style.transition = '';
          piece.classList.remove('bounce-wrong');
          if(nudge) nudge.style.display = '';
        }, 500);
      }
    }

    piece.addEventListener('pointerdown', onDown);
  }

  /* ================================================================== */
  /*  FINAL SORTING GAME                                                  */
  /*  Plays after all shape tutorials. Multi-round drag-and-drop where    */
  /*  new toys spawn on the left and the player drags each one onto the  */
  /*  cupboard row whose label matches the toy's 3D shape.                */
  /* ================================================================== */
  var TARGETS_BY_SHAPE = {
    cone:     { x:616.04, y:238.35, w:1220.45, h:218.55 },
    sphere:   { x:616.04, y:435.68, w:1220.45, h:218.55 },
    cylinder: { x:616.04, y:633.01, w:1220.45, h:218.55 },
    cube:     { x:616.04, y:830.35, w:1220.45, h:218.55 }
  };

  /* Each toy in this list becomes one round of the sorting game.
     Order matters — dice/rubic at the end so the wrong-attempt
     scaffolding has interesting things to land on. Placed positions
     sit to the right of the tutorial-placed shapes so the rows
     accumulate left-to-right as the game progresses. */
  /* All placed positions come from Figma slide 100 (cupboard@322) with a
     +260 x-shift applied so they line up with our cupboard@582. Sizes
     match Figma exactly. Drag sizes are uniform (≈300) so each toy fills
     the 397×397 spawn box prominently; tennis ball is smaller since its
     placed form is tiny. */
  var TOYS = [
    /* CONE shelf — 2 additional items beyond tutorial-placed cap. */
    { png:'tree.png',         shape:'cone',
      drag:   { w:380, h:380 },
      /* Tree PNG has heavy transparent padding — bounding box bumped
         to 320×320 so the visible tree renders at the same scale as
         the party hat sitting next to it. */
      placed: { x:1200, y:178, w:320, h:320 } },
    { png:'cone.png',         shape:'cone',
      drag:   { w:300, h:300 },
      placed: { x:1570, y:266, w:207, h:207 } },
    /* SPHERE shelf — 2 additional items beyond tutorial-placed football. */
    { png:'basketball.png',   shape:'sphere',
      drag:   { w:300, h:300 },
      placed: { x:1293, y:474, w:176, h:176 } },
    { png:'tennis ball.png',  shape:'sphere',
      drag:   { w:200, h:200 },
      placed: { x:1626, y:552, w: 88, h: 88 } },
    /* CYLINDER shelf — 2 additional items beyond tutorial-placed drum. */
    { png:'jar.png',          shape:'cylinder',
      drag:   { w:300, h:300 },
      placed: { x:1301, y:672, w:158, h:158 } },
    { png:'bucket.png',       shape:'cylinder',
      drag:   { w:300, h:300 },
      placed: { x:1583, y:664, w:174, h:174 } },
    /* CUBE shelf — 2 additional items beyond tutorial-placed block. */
    { png:'dice.png',         shape:'cube',
      drag:   { w:340, h:340 },
      /* Dice PNG has padding too — boost bounds so the visible dice
         lines up with the block / rubic on the same shelf. */
      placed: { x:1290, y:850, w:200, h:200 } },
    { png:'rubic.png',        shape:'cube',
      drag:   { w:300, h:300 },
      placed: { x:1598, y:899, w:129, h:129 } }
  ];

  /* Spawn box — exact Figma position/size (node "Group 23" frame).
     Fixed location for every round; toys appear inside it. */
  var SPAWN_BOX_X = 118.81;
  var SPAWN_BOX_Y = 422;
  var SPAWN_BOX_W = 397.01;
  var SPAWN_BOX_H = 397.01;

  var gameRound        = 0;
  var gameWrongCount   = 0;
  var gameNudgeTimer   = null;
  /* Shuffled per-run copy of TOYS. Built each time the sorting game
     starts so toys appear in a different order every playthrough. */
  var gameToyOrder     = null;

  /* Fisher-Yates in-place shuffle. */
  function shuffleArray(arr){
    for(var i = arr.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* Build a single sorting-game round.  */
  function buildGameRound(idx){
    clearStage();
    clearTimeout(gameNudgeTimer);
    gameWrongCount = 0;

    /* Use the shuffled order built at game start. Fallback to TOYS
       if for any reason shuffle wasn't initialized. */
    var list = gameToyOrder || TOYS;
    if(idx < 0 || idx >= list.length){
      buildGameCelebration();
      return;
    }
    var toy = list[idx];

    addImg('blur black.png',    'gs-blur');
    addImg('full cupboard.png', 'gs-cupboard');

    /* All previously-placed toys (tutorial + earlier rounds) */
    renderPersistentPlacements();

    /* Top banner — Aanya speaks */
    addImg('Question template.png', 'gs-banner');
    var bt = addDiv('gs-banner-text');
    bt.id = 'gs-game-banner-text';
    bt.textContent = 'Drag this toy to the correct shelf.';

    /* Spawn box at the fixed Figma position (118.81, 422) × 397×397. */
    var box = addDiv('gs-spawn-box');
    box.style.left   = SPAWN_BOX_X + 'px';
    box.style.top    = SPAWN_BOX_Y + 'px';
    box.style.width  = SPAWN_BOX_W + 'px';
    box.style.height = SPAWN_BOX_H + 'px';

    /* Draggable toy centered inside the spawn box. */
    var pieceX = SPAWN_BOX_X + (SPAWN_BOX_W - toy.drag.w) / 2;
    var pieceY = SPAWN_BOX_Y + (SPAWN_BOX_H - toy.drag.h) / 2;

    var piece = addDiv('gs-cube-drag gs-game-piece');
    piece.style.left   = pieceX + 'px';
    piece.style.top    = pieceY + 'px';
    piece.style.width  = toy.drag.w + 'px';
    piece.style.height = toy.drag.h + 'px';
    var img = document.createElement('img');
    img.src = resolveAsset(toy.png);
    img.draggable = false;
    img.alt = '';
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;' +
                        'user-select:none;-webkit-user-drag:none;pointer-events:none;';
    piece.appendChild(img);

    setupGameDrag(piece, toy, pieceX, pieceY);

    /* Nudge after 3s idle (per spec) */
    scheduleGameNudge(toy, pieceX, pieceY);
  }

  /* Place / animate nudge arrow + hand from spawn to correct shelf. */
  function showGameNudge(toy, pieceX, pieceY){
    hideGameNudge();
    var target = TARGETS_BY_SHAPE[toy.shape];
    var targetCx = target.x + target.w / 2;
    var targetCy = target.y + target.h / 2;
    var startCx  = pieceX + toy.drag.w / 2;
    var startCy  = pieceY + toy.drag.h / 2;
    var dx = targetCx - startCx;
    var dy = targetCy - startCy;
    var dist = Math.sqrt(dx*dx + dy*dy);
    var angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

    /* Vector 1 dashed arc — stretched along the spawn→target line */
    var arrow = addImg('Vector 1.png', 'gs-game-nudge-arrow');
    arrow.style.left   = startCx + 'px';
    arrow.style.top    = (startCy - 60) + 'px';
    arrow.style.width  = dist + 'px';
    arrow.style.height = '120px';
    arrow.style.transformOrigin = '0 50%';
    arrow.style.transform = 'rotate(' + angleDeg + 'deg)';

    /* Hand glides from spawn toward target */
    var hand = addImg('Swipe Up And Click 7.png', 'gs-game-nudge-hand');
    hand.style.left = (startCx - 110) + 'px';
    hand.style.top  = (startCy - 110) + 'px';
    hand.style.setProperty('--hand-dx', dx + 'px');
    hand.style.setProperty('--hand-dy', dy + 'px');
  }
  function hideGameNudge(){
    if(!stage) return;
    var arr = stage.querySelector('.gs-game-nudge-arrow');
    var hd  = stage.querySelector('.gs-game-nudge-hand');
    if(arr) arr.remove();
    if(hd)  hd.remove();
  }
  function scheduleGameNudge(toy, pieceX, pieceY){
    clearTimeout(gameNudgeTimer);
    gameNudgeTimer = setTimeout(function(){
      showGameNudge(toy, pieceX, pieceY);
    }, 3000);
  }

  /* Identify which shelf row (if any) the given stage-coord point lands on.
     Returns the shape-name ('cube' | 'cone' | 'sphere' | 'cylinder') or null. */
  function rowAt(x, y){
    for(var k in TARGETS_BY_SHAPE){
      var t = TARGETS_BY_SHAPE[k];
      if(x >= t.x && x <= t.x + t.w &&
         y >= t.y && y <= t.y + t.h){
        return k;
      }
    }
    return null;
  }

  /* Briefly flash a row red to signal a wrong drop. */
  function flashWrongRow(shapeKey){
    var t = TARGETS_BY_SHAPE[shapeKey];
    if(!t) return;
    var flash = addDiv('gs-game-row-flash');
    applyRect(flash, t);
    setTimeout(function(){ if(flash.parentNode) flash.remove(); }, 600);
  }

  /* Drag handler dedicated to the sorting game. Reuses the same pointer
     math as setupDrag but with row hit-tests and per-toy snap targets. */
  function setupGameDrag(piece, toy, startX, startY){
    var dragging = false;
    var offX = 0, offY = 0;
    var stageRect, scale;

    function toStage(clientX, clientY){
      stageRect = stage.getBoundingClientRect();
      scale = stageRect.width / STAGE_W;
      return {
        x: (clientX - stageRect.left) / scale,
        y: (clientY - stageRect.top)  / scale
      };
    }

    function onDown(e){
      e.preventDefault();
      dragging = true;
      piece.classList.add('dragging');
      clearTimeout(gameNudgeTimer);
      hideGameNudge();
      sfxPickup();

      var p = toStage(e.clientX, e.clientY);
      var rect = piece.getBoundingClientRect();
      var pieceLeft = (rect.left - stageRect.left) / scale;
      var pieceTop  = (rect.top  - stageRect.top)  / scale;
      offX = p.x - pieceLeft;
      offY = p.y - pieceTop;

      window.addEventListener('pointermove',   onMove);
      window.addEventListener('pointerup',     onUp);
      window.addEventListener('pointercancel', onUp);
    }

    function onMove(e){
      if(!dragging) return;
      var p = toStage(e.clientX, e.clientY);
      piece.style.left = (p.x - offX) + 'px';
      piece.style.top  = (p.y - offY) + 'px';
    }

    function onUp(){
      if(!dragging) return;
      dragging = false;
      piece.classList.remove('dragging');
      window.removeEventListener('pointermove',   onMove);
      window.removeEventListener('pointerup',     onUp);
      window.removeEventListener('pointercancel', onUp);

      var rect = piece.getBoundingClientRect();
      var cx = (rect.left + rect.width / 2  - stageRect.left) / scale;
      var cy = (rect.top  + rect.height / 2 - stageRect.top)  / scale;
      var landed = rowAt(cx, cy);

      if(landed === toy.shape){
        /* CORRECT */
        piece.classList.add('correct-snap');
        sfxCorrect();
        var p = toy.placed;
        piece.style.transition =
          'left .45s cubic-bezier(.34,1.56,.64,1), ' +
          'top .45s cubic-bezier(.34,1.56,.64,1), ' +
          'width .45s ease, height .45s ease';
        piece.style.left   = p.x + 'px';
        piece.style.top    = p.y + 'px';
        piece.style.width  = p.w + 'px';
        piece.style.height = p.h + 'px';
        placedShapes.push({
          png: toy.png,
          placed: { x:p.x, y:p.y, w:p.w, h:p.h }
        });
        updateGameBanner('That is correct!');
        setTimeout(function(){
          gameRound++;
          buildGameRound(gameRound);
        }, 1200);
      } else {
        /* WRONG — bounce back, flash the row they landed on (if any),
           and on the 2nd attempt swap the banner text. */
        gameWrongCount++;
        sfxWrong();
        if(landed){ flashWrongRow(landed); }
        piece.classList.add('bounce-wrong');
        piece.style.transition =
          'left .45s cubic-bezier(.34,1.56,.64,1), ' +
          'top .45s cubic-bezier(.34,1.56,.64,1)';
        piece.style.left = startX + 'px';
        piece.style.top  = startY + 'px';
        setTimeout(function(){
          piece.style.transition = '';
          piece.classList.remove('bounce-wrong');
        }, 500);

        if(gameWrongCount >= 2){
          updateGameBanner('Oops! Try again.');
          setTimeout(function(){
            updateGameBanner('Drag this toy to the correct shelf.');
          }, 2200);
        }
        /* Re-arm the nudge so it shows up after another idle window. */
        scheduleGameNudge(toy, startX, startY);
      }
    }

    piece.addEventListener('pointerdown', onDown);
  }

  function updateGameBanner(text){
    var bt = document.getElementById('gs-game-banner-text');
    if(bt) bt.textContent = text;
  }

  /* Final celebration after the last round. Camera pulls back from a
     tight shot on the cube shelf to the full cupboard while a magical
     confetti burst rains down. Hold for ~2 s of "admire the result",
     then hand off to the flipbook. */
  function buildGameCelebration(){
    clearStage();
    addImg('blur black.png',    'gs-blur');
    addImg('full cupboard.png', 'gs-cupboard');
    renderPersistentPlacements();

    addImg('Question template.png', 'gs-banner');
    var bt = addDiv('gs-banner-text');
    bt.textContent = 'Great job! You sorted them all!';

    /* Trigger the camera pull-back animation on the stage. The class
       is removed when the animation ends so the base responsive
       transform takes over (and window-resizes keep working). */
    stage.classList.add('celebration-camera');
    setTimeout(function(){
      stage.classList.remove('celebration-camera');
    }, 2450);

    /* Magical confetti burst — stars, sparkles, glowing dots in
       gold / pink / purple / cyan, with random spin + horizontal drift. */
    burstCelebrationConfetti();

    /* Cheerful chime to punctuate the moment. */
    try{ playSuccessChime(); }catch(e){}

    /* Hand control back to the queue (which fades the overlay and
       triggers onComplete → flipbook turns to page 5). Slightly
       longer than before so camera + confetti can finish. */
    setTimeout(close, 5000);
  }

  /* Spawn ~100 confetti particles inside the stage. Magical palette:
     warm golds + pinks paired with cool violets + cyans so it reads
     against any backdrop. Each particle picks a random shape, color,
     fall trajectory, spin direction, scale, and delay. */
  function burstCelebrationConfetti(){
    var container = addDiv('gs-confetti-container');
    var COLORS = [
      '#FFD93D',  /* gold       */
      '#FFB14F',  /* warm orange*/
      '#FF6BCB',  /* pink       */
      '#A66CFF',  /* magic purple */
      '#7DD3FC',  /* cyan       */
      '#6BCB77',  /* mint       */
      '#FFFFFF'   /* sparkle white */
    ];
    var SHAPES = ['star', 'sparkle', 'circle', 'chip',
                  'star', 'sparkle', 'circle'];   /* weight star/sparkle */
    var COUNT = 110;

    for(var i = 0; i < COUNT; i++){
      var c = document.createElement('div');
      var shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      var color = COLORS[Math.floor(Math.random() * COLORS.length)];
      c.className = 'gs-confetti ' + shape;
      c.style.left = (Math.random() * 1920) + 'px';
      c.style.setProperty('--col',   color);
      c.style.setProperty('--fall-x',
        ((Math.random() - 0.5) * 700) + 'px');
      c.style.setProperty('--spin',
        ((Math.random() > 0.5 ? 1 : -1) *
         (360 + Math.random() * 720)) + 'deg');
      c.style.setProperty('--dur',
        (3.2 + Math.random() * 2.2) + 's');
      c.style.setProperty('--delay',
        (Math.random() * 1.6) + 's');
      c.style.setProperty('--start-scale',
        (0.35 + Math.random() * 0.25) + '');
      c.style.setProperty('--peak-scale',
        (0.85 + Math.random() * 0.55) + '');
      container.appendChild(c);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Screen orchestration                                               */
  /*  Built per-shape so each shape can have its own dialogue count      */
  /*  (cube/cone = 3 lines, sphere = 4 lines).                           */
  /* ------------------------------------------------------------------ */
  var SCREENS = [];

  function buildScreensForCurrentShape(){
    var arr = [];
    for(var i = 0; i < currentShape.dialogues.length; i++){
      (function(idx){
        arr.push(function(){ buildDialogue(idx); });
      })(i);
    }
    arr.push(function(){ buildDragScreen();    });
    arr.push(function(){ buildSuccessScreen(); });
    return arr;
  }

  function showScreen(idx){
    currentScreen = idx;
    SCREENS[idx]();
  }

  function nextScreen(){
    if(currentScreen < SCREENS.length - 1){
      showScreen(currentScreen + 1);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API — chained shape sequence                                */
  /* ------------------------------------------------------------------ */
  function playNextShape(){
    if(queue.length === 0){
      /* All shapes complete — fade overlay and call onComplete */
      overlay.classList.remove('show');
      setTimeout(function(){
        overlay.classList.remove('visible');
        clearStage();
        var cb = onComplete; onComplete = null;
        if(cb) cb();
      }, 400);
      return;
    }
    var key = queue.shift();
    if(key === 'game'){
      /* Hand off to the sorting game; its rounds + celebration
         will call close() (→ playNextShape) when finished.
         Shuffle the TOYS list so each playthrough has a different
         toy order (otherwise it's cone→cone→sphere→sphere→…). */
      gameRound = 0;
      gameToyOrder = shuffleArray(TOYS.slice());
      buildGameRound(0);
      return;
    }
    currentShape = SHAPES[key];
    if(!currentShape){ playNextShape(); return; }
    currentShape._key = key;
    SCREENS = buildScreensForCurrentShape();
    showScreen(0);
  }

  function openShapes(shapes, cb){
    if(!stage) init();
    if(!stage) return;
    if(!Array.isArray(shapes)) shapes = [shapes];
    queue = shapes.slice();
    onComplete = cb || null;
    placedShapes = [];          /* fresh cupboard at the start of a run */
    overlay.classList.add('visible');
    void overlay.offsetWidth;
    overlay.classList.add('show');
    playNextShape();
  }

  /* Called by the success-screen timeout. Advances to the next shape
     in the queue (or fades out if the queue is empty). */
  function close(){
    playNextShape();
  }

  /* Auto-init when DOM is ready */
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Public:
       startShapeGames(['cube','cone'], onAllDone)  — preferred, chained
       startCubeGame(onDone)                        — backward compat */
  window.startShapeGames = openShapes;
  window.startCubeGame   = function(cb){ openShapes(['cube'], cb); };
})();
