/* StockPilot motion layer. Powered by Motion (the Framer Motion animation engine).
   Declarative attributes:
   data-m="scr-f|scr-b|fade|pop|slide|toast|stamp|rise|tick|word-a|word-b|word-c|shake-a|shake-b|prog|draw|svg-pop|scan|splash"
        + data-md (delay ms), data-mdur (s), data-len (stroke length)
   data-stagger          children enter in 0.05 s increments
   data-sp='{"p":{...},"t":{...}}'   spring any style to new values when the attribute changes
   data-hover, data-hs / data-hx / data-hy   hover target (default scale 1.02); buttons get hover + tap automatically; data-nm opts out
   data-loop="pulse|blink|shimmer|shimmer-text|sweep|blip|orbit|breathe"   data-ld = seconds
   data-ai="<px>"        morphing-blob "thinking" glyph */
(function () {
  if (window.__spMotion) return; window.__spMotion = 1;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  var HOVER = { type: 'spring', stiffness: 400, damping: 25, mass: 1 };
  var PANEL = { type: 'spring', stiffness: 300, damping: 30 };
  var STEP = 0.05;
  var guard = document.createElement('style'); guard.id = 'sp-motion-guard';
  guard.textContent = '[data-m]:not([data-mdone]){opacity:0}';
  document.head.appendChild(guard);
  setTimeout(function () {
    if (window.Motion) return;
    guard.remove();
    [].forEach.call(document.querySelectorAll('[data-m="splash"]'), function (e) { e.style.display = 'none'; });
  }, 4000);

  function boot() {
    var M = window.Motion, animate = M.animate, seen = new WeakSet(), uid = 0;
    var T = function (t) { return RM ? { duration: 0 } : t; };
    var run = function (el, to, t) { return animate(el, to, T(t)); };
    var val = function (from, to, t, fn) { return animate(from, to, Object.assign({}, T(t), { onUpdate: fn })); };
    var num = function (el, k, d) { var v = parseFloat(el.getAttribute(k)); return isNaN(v) ? d : v; };
    var spr = function (d, extra) { return Object.assign({ type: 'spring', stiffness: 300, damping: 30, delay: d }, extra || {}); };

    function enter(el) {
      var m = el.getAttribute('data-m'); if (!m) { el.setAttribute('data-mdone', '1'); return; }
      var d = num(el, 'data-md', 0) / 1000, dur = num(el, 'data-mdur', 0), P = spr(d);
      var hide = function () { el.style.opacity = '0'; };
      switch (m) {
        case 'scr-f': hide(); run(el, { x: [32, 0], opacity: [0, 1] }, P); break;
        case 'scr-b': hide(); run(el, { x: [-32, 0], opacity: [0, 1] }, P); break;
        case 'fade': hide(); run(el, { opacity: [0, 1] }, P); break;
        case 'pop': hide(); run(el, { scale: [0.94, 1], y: [10, 0], opacity: [0, 1] }, P); break;
        case 'slide': hide(); el.style.transform = 'translateX(100%)'; run(el, { x: ['100%', '0%'], opacity: [1, 1] }, P); break;
        case 'toast': hide(); run(el, { y: [14, 0], scale: [0.94, 1], opacity: [0, 1] }, spr(d, { stiffness: 400, damping: 28 })); break;
        case 'rise': case 'rise2': hide(); run(el, { y: [10, 0], opacity: [0, 1] }, P); break;
        case 'tick': hide(); run(el, { x: [-8, 0], opacity: [0, 1] }, P); break;
        case 'word-a': case 'word-b': case 'word-c':
          hide(); el.style.filter = 'blur(5px)';
          run(el, { y: [6, 0], opacity: [0, 1], filter: ['blur(5px)', 'blur(0px)'] }, spr(d, { stiffness: 260, damping: 28 })); break;
        case 'shake-a': case 'shake-b': hide(); el.style.opacity = '1'; run(el, { x: [-10, 0] }, { type: 'spring', stiffness: 700, damping: 6 }); break;
        case 'stamp': hide(); run(el, { x: ['-50%', '-50%'], y: ['-50%', '-50%'], scale: [1.4, 1], rotate: [-10, -3], opacity: [0, 1] }, spr(d, { stiffness: 320, damping: 16 })); break;
        case 'prog': el.style.transform = 'scaleX(0)'; el.style.opacity = '1'; run(el, { scaleX: [0, 1] }, { type: 'spring', duration: dur || 0.9, bounce: 0, delay: d }); break;
        case 'scan': hide(); el.style.opacity = '1'; run(el, { y: ['-110%', '260%'] }, { type: 'spring', duration: 0.9, bounce: 0, delay: d }).then(function () { el.style.display = 'none'; }); break;
        case 'scroll-prog': el.style.opacity = '1'; if (!RM) M.scroll(animate(el, { scaleX: [0, 1] }, { ease: 'linear' })); break;
        case 'draw': var len = num(el, 'data-len', 40); el.style.strokeDashoffset = len; el.style.opacity = '1'; val(len, 0, { type: 'spring', duration: dur || 0.9, bounce: 0, delay: d }, function (v) { el.style.strokeDashoffset = v; }); break;
        case 'svg-pop': hide(); el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center'; val(0, 1, spr(d, { stiffness: 380, damping: 18 }), function (v) { el.style.transform = 'scale(' + (0.5 + 0.5 * v) + ')'; el.style.opacity = Math.min(1, v * 2); }); break;
        case 'splash':
          el.style.opacity = '1';
          setTimeout(function () { var a = run(el, { opacity: [1, 0] }, PANEL); a.then(function () { el.style.display = 'none'; }); }, RM ? 0 : 1500);
          break;
      }
      el.setAttribute('data-mdone', '1');
    }

    function stagger(parent) {
      [].forEach.call(parent.children, function (c, i) {
        if (seen.has(c)) return; seen.add(c);
        c.style.opacity = '0';
        run(c, { y: [14, 0], opacity: [0, 1] }, spr(Math.min(i, 16) * STEP));
      });
    }

    function spring(el, first) {
      var o; try { o = JSON.parse(el.getAttribute('data-sp')); } catch (e) { return; }
      if (!o || !o.p) return;
      run(el, o.p, first ? { duration: 0 } : (o.t || { type: 'spring', stiffness: 400, damping: 30 }));
    }

    function loop(el) {
      if (el.__stop) { el.__stop(); el.__stop = null; el.style.transform = ''; el.style.opacity = ''; if (el.__lk === 'shimmer-text') { var q = el.style; q.backgroundImage = ''; q.backgroundSize = ''; q.webkitBackgroundClip = ''; q.backgroundClip = ''; q.webkitTextFillColor = ''; q.color = ''; } el.__lk = null; }
      var k = el.getAttribute('data-loop'); if (!k || RM) return; el.__lk = k;
      if (window.SVGElement && el instanceof SVGElement && k !== 'sweep') { el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center'; }
      var dl = num(el, 'data-md', 0) / 1000, B = { repeat: Infinity, delay: dl };
      var ld = num(el, 'data-ld', 1.6), a = [];
      var rep = { repeat: Infinity, ease: 'easeInOut' }, mir = Object.assign({}, rep, { repeatType: 'mirror' });
      if (k === 'pulse') a.push(animate(el, { opacity: [0.5, 1] }, Object.assign({ duration: ld / 2 }, mir)));
      else if (k === 'blink') a.push(animate(el, { opacity: [1, 1, 0, 0] }, { duration: el.hasAttribute('data-ld') ? ld : 1, times: [0, 0.49, 0.5, 1], repeat: Infinity, ease: 'linear' }));
      else if (k === 'shimmer') a.push(animate(el, { backgroundPosition: ['200% 0', '-200% 0'] }, { duration: ld, repeat: Infinity, ease: 'linear' }));
      else if (k === 'shimmer-text') {
        var s = el.style; s.backgroundImage = 'linear-gradient(100deg,var(--ink-3,var(--mut,#888)) 35%,var(--accent,var(--a,#c6f24b)) 50%,var(--ink-3,var(--mut,#888)) 65%)'; s.backgroundSize = '250% 100%';
        s.webkitBackgroundClip = 'text'; s.backgroundClip = 'text'; s.webkitTextFillColor = 'transparent'; s.color = 'transparent';
        a.push(animate(el, { backgroundPosition: ['150% 0', '-50% 0'] }, { duration: 2.2, repeat: Infinity, ease: 'linear' }));
      }
      else if (k === 'sweep' || k === 'orbit') a.push(val(0, 360, { duration: num(el, 'data-ld', 7), repeat: Infinity, ease: 'linear' }, function (v) { el.style.transform = 'rotate(' + v + 'deg)'; }));
      else if (k === 'blip') a.push(val(1, 1.4, Object.assign({ duration: 0.8 }, mir), function (v) { el.style.transform = 'scale(' + v + ')'; }));
      else if (k === 'breathe') a.push(val(0, 1, Object.assign({ duration: ld / 2 }, mir), function (v) { el.style.transform = 'scale(' + (0.85 + 0.3 * v) + ')'; el.style.opacity = 0.4 + 0.6 * v; }));
      else if (k === 'ping') a.push(val(0, 1, Object.assign({ duration: ld, ease: 'easeOut' }, B), function (v) { el.style.transform = 'scale(' + (1 + 1.1 * v) + ')'; el.style.opacity = 0.7 * (1 - v); }));
      else if (k === 'bob') a.push(val(0, 1, Object.assign({ duration: ld / 2, ease: 'easeInOut', repeatType: 'mirror' }, B), function (v) { el.style.transform = 'translateY(' + (-5 * v) + 'px)'; }));
      else if (k === 'wave') a.push(val(0, 1, Object.assign({ duration: ld / 2, ease: 'easeInOut', repeatType: 'mirror' }, B), function (v) { el.style.transform = 'scaleY(' + (0.3 + 0.7 * v) + ')'; }));
      else if (k === 'dash') a.push(val(0, -8, { duration: 0.7, repeat: Infinity, ease: 'linear' }, function (v) { el.style.strokeDashoffset = v; }));
      else if (k === 'blinkeye') a.push(val(0, 1, Object.assign({ duration: ld, ease: 'linear' }, B), function (v) { el.style.transform = 'scaleY(' + (v > 0.9 && v < 0.97 ? 0.1 : 1) + ')'; }));
      else if (k === 'look') a.push(val(0, 1, Object.assign({ duration: ld, ease: 'easeInOut', repeatType: 'mirror' }, B), function (v) { el.style.transform = 'translateX(' + (-3 + 6 * v) + 'px)'; }));
      else if (k === 'marquee') a.push(val(0, -50, { duration: ld, repeat: Infinity, ease: 'linear' }, function (v) { el.style.transform = 'translateX(' + v + '%)'; }));
      el.__stop = function () { a.forEach(function (x) { try { x.stop(); } catch (e) {} }); };
    }

    function blob(t, R, ph) {
      var N = 8, p = [], i, a, r;
      for (i = 0; i < N; i++) { a = i / N * 6.2832; r = R * (1 + 0.17 * Math.sin(a * 2 + t + ph) + 0.11 * Math.sin(a * 3 - t * 2 + ph) + 0.07 * Math.sin(a * 5 + t)); p.push([r * Math.cos(a), r * Math.sin(a)]); }
      var d = 'M' + p[0][0].toFixed(2) + ' ' + p[0][1].toFixed(2);
      for (i = 0; i < N; i++) {
        var p0 = p[(i + N - 1) % N], p1 = p[i], p2 = p[(i + 1) % N], p3 = p[(i + 2) % N];
        d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(2) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(2) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(2) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(2) + ' ' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2);
      }
      return d + 'Z';
    }
    function ai(el) {
      if (el.__ai) return; el.__ai = 1;
      var S = num(el, 'data-ai', 20), id = 'spg' + (++uid);
      el.style.cssText += ';display:inline-block;flex:none;width:' + S + 'px;height:' + S + 'px;line-height:0';
      el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Pilot is thinking');
      var root = el.shadowRoot || el.attachShadow({ mode: 'open' });
      root.innerHTML = '<svg viewBox="-50 -50 100 100" width="' + S + '" height="' + S + '" style="display:block;overflow:visible"><defs><radialGradient id="' + id + '"><stop offset="0" stop-color="var(--accent)" stop-opacity=".55"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></radialGradient></defs><circle r="50" fill="url(#' + id + ')" style="transform-box:fill-box;transform-origin:center"/><path style="fill:var(--accent)" d="' + blob(0, 22, 0) + '"/><path style="fill:none;stroke:var(--accent);stroke-width:2.4;opacity:.65" d="' + blob(0, 33, 2) + '"/></svg>';
      if (RM) return;
      var g = root.querySelector('circle'), ps = root.querySelectorAll('path'), core = ps[0], ring = ps[1];
      val(0, 6.2832, { duration: 5, repeat: Infinity, ease: 'linear' }, function (t) { core.setAttribute('d', blob(t, 22, 0)); ring.setAttribute('d', blob(-t, 33, 2)); });
      val(0, 1, { duration: 1.1, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }, function (v) { g.style.transform = 'scale(' + (0.75 + 0.3 * v) + ')'; g.style.opacity = 0.45 + 0.55 * v; });
    }

    function init(el) {
      if (el.hasAttribute('data-m') && !el.hasAttribute('data-mdone')) enter(el);
      if (el.hasAttribute('data-sp') && !el.__sp) { el.__sp = 1; spring(el, true); }
      if (el.hasAttribute('data-loop') && !el.__stop) loop(el);
      if (el.hasAttribute('data-ai')) ai(el);
      if (el.hasAttribute('data-stagger')) stagger(el);
    }
    var SEL = '[data-m],[data-sp],[data-loop],[data-ai],[data-stagger]';
    function scan(root) {
      if (root.nodeType !== 1) return;
      var p = root.parentElement;
      if (p && p.hasAttribute('data-stagger') && !seen.has(root)) { seen.add(root); root.style.opacity = '0'; run(root, { y: [14, 0], opacity: [0, 1] }, spr(Math.min([].indexOf.call(p.children, root), 16) * STEP)); }
      init(root); [].forEach.call(root.querySelectorAll(SEL), init);
    }
    new MutationObserver(function (list) {
      list.forEach(function (r) {
        if (r.type === 'childList') [].forEach.call(r.addedNodes, scan);
        else if (r.type === 'attributes' && r.target.nodeType === 1) {
          var el = r.target, n = r.attributeName;
          if (n === 'data-m') { el.removeAttribute('data-mdone'); enter(el); }
          else if (n === 'data-sp') spring(el, false);
          else if (n === 'data-loop' || n === 'data-ld') loop(el);
        }
      });
      sweep();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-m', 'data-sp', 'data-loop', 'data-ld'] });
    function sweep() {
      [].forEach.call(document.querySelectorAll('[data-m]:not([data-mdone]),[data-loop],[data-ai],[data-sp],[data-stagger]'), function (el) {
        if (el.hasAttribute('data-loop') && !el.getAttribute('data-loop')) return;
        if (el.hasAttribute('data-m') && !el.hasAttribute('data-mdone')) enter(el);
        if (el.hasAttribute('data-sp') && !el.__sp) { el.__sp = 1; spring(el, true); }
        if (el.hasAttribute('data-loop') && !el.__stop) loop(el);
        if (el.hasAttribute('data-ai') && !el.__ai) ai(el);
        if (el.hasAttribute('data-stagger')) stagger(el);
      });
    }
    scan(document.body); sweep(); setInterval(sweep, 100);

    /* hover + tap, delegated */
    var press = null;
    var tgt = function (e) { var el = e.target && e.target.closest ? e.target.closest('button,[data-hover],[data-tap]') : null; return el && !el.disabled && !el.hasAttribute('data-nm') ? el : null; };
    var hv = function (el) { return { scale: num(el, 'data-hs', 1.02), x: num(el, 'data-hx', 0), y: num(el, 'data-hy', 0) }; };
    var rest = { scale: 1, x: 0, y: 0 };
    var tappable = function (el) { return el.tagName === 'BUTTON' || el.hasAttribute('data-tap'); };
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch') return; var el = tgt(e); if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      el.__h = 1; if (!el.__p) run(el, hv(el), HOVER);
    });
    document.addEventListener('pointerout', function (e) {
      var el = tgt(e); if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      el.__h = 0; if (!el.__p) run(el, rest, HOVER);
    });
    document.addEventListener('pointerdown', function (e) {
      var el = tgt(e); if (!el || !tappable(el) || e.button > 0) return;
      el.__p = 1; press = el; run(el, { scale: 0.97 }, HOVER);
    }, true);
    var release = function () {
      var el = press; if (!el) return; press = null; el.__p = 0;
      run(el, el.__h ? hv(el) : rest, HOVER);
    };
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
    window.__spMotionReady = true;
  }
  (function wait() { if (window.Motion && document.body) boot(); else setTimeout(wait, 15); })();
})();
