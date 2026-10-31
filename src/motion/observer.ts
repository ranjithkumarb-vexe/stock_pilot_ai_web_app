/**
 * Optional attribute-driven layer: the exact authoring model of the design (`data-m`, `data-md`, `data-mdur`,
 * `data-len`, `data-stagger`, `data-sp`, `data-loop`, `data-ld`, `data-ai`). It lets a screen be ported by copying
 * the design markup verbatim. Prefer <Enter>/<Stagger>/<Loop>/useEnter in new code; both share the same engine.
 * Install once (done in <MotionRoot>). Elements managed by hooks carry no data-* motion attributes, so there is no overlap.
 */
import {
  animateBlob,
  blobPath,
  enter,
  loop,
  springTo,
  staggerChild,
  type EnterKind,
  type LoopKind,
  type Stop,
} from './engine';

const SEL = '[data-m],[data-sp],[data-loop],[data-ai],[data-stagger]';
const num = (el: Element, k: string, d: number) => {
  const v = parseFloat(el.getAttribute(k) ?? '');
  return Number.isNaN(v) ? d : v;
};

type Rec = { loop?: Stop; ai?: Stop; enter?: Stop; sp?: boolean };

export function installMotionObserver(root: HTMLElement = document.body): () => void {
  const recs = new WeakMap<Element, Rec>();
  const seen = new WeakSet<Element>();
  const rec = (el: Element): Rec => {
    let r = recs.get(el);
    if (!r) {
      r = {};
      recs.set(el, r);
    }
    return r;
  };

  const doEnter = (el: Element) => {
    const kind = el.getAttribute('data-m');
    if (!kind) {
      el.setAttribute('data-mdone', '1');
      return;
    }
    rec(el).enter?.();
    rec(el).enter = enter(el, kind as EnterKind, {
      delay: num(el, 'data-md', 0),
      duration: num(el, 'data-mdur', 0),
      len: num(el, 'data-len', 40),
    });
  };
  const doSp = (el: Element, first: boolean) => {
    try {
      const o = JSON.parse(el.getAttribute('data-sp') ?? 'null') as {
        p?: Record<string, unknown>;
        t?: Record<string, unknown>;
      } | null;
      if (o?.p) springTo(el, o.p, o.t, first);
    } catch {
      /* malformed data-sp is ignored, like the design */
    }
  };
  const doLoop = (el: Element) => {
    const r = rec(el);
    r.loop?.();
    r.loop = undefined;
    const k = el.getAttribute('data-loop');
    if (!k) return;
    r.loop = loop(el, k as LoopKind, {
      duration: el.hasAttribute('data-ld') ? num(el, 'data-ld', 1.6) : undefined,
      delay: num(el, 'data-md', 0),
    });
  };
  const doAi = (el: Element) => {
    const r = rec(el);
    if (r.ai) return;
    const S = num(el, 'data-ai', 20);
    const id = `spg${Math.random().toString(36).slice(2, 8)}`;
    const host = el as HTMLElement;
    host.style.cssText += `;display:inline-block;flex:none;width:${S}px;height:${S}px;line-height:0`;
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', 'Pilot is thinking');
    const sr = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    sr.innerHTML = `<svg viewBox="-50 -50 100 100" width="${S}" height="${S}" style="display:block;overflow:visible"><defs><radialGradient id="${id}"><stop offset="0" stop-color="var(--accent)" stop-opacity=".55"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></radialGradient></defs><circle r="50" fill="url(#${id})" style="transform-box:fill-box;transform-origin:center"/><path style="fill:var(--accent)" d="${blobPath(0, 22, 0)}"/><path style="fill:none;stroke:var(--accent);stroke-width:2.4;opacity:.65" d="${blobPath(0, 33, 2)}"/></svg>`;
    const g = sr.querySelector('circle');
    const ps = sr.querySelectorAll('path');
    if (g && ps[0] && ps[1]) r.ai = animateBlob(ps[0], ps[1], g);
    else r.ai = () => {};
  };

  const init = (el: Element) => {
    if (el.hasAttribute('data-m') && !el.hasAttribute('data-mdone')) doEnter(el);
    if (el.hasAttribute('data-sp') && !rec(el).sp) {
      rec(el).sp = true;
      doSp(el, true);
    }
    if (el.hasAttribute('data-loop') && !rec(el).loop) doLoop(el);
    if (el.hasAttribute('data-ai')) doAi(el);
    if (el.hasAttribute('data-stagger')) {
      Array.from(el.children).forEach((c, i) => {
        if (seen.has(c)) return;
        seen.add(c);
        staggerChild(c, i);
      });
    }
  };
  const scan = (node: Node) => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const p = el.parentElement;
    if (p && p.hasAttribute('data-stagger') && !seen.has(el)) {
      seen.add(el);
      staggerChild(el, Array.prototype.indexOf.call(p.children, el));
    }
    init(el);
    el.querySelectorAll(SEL).forEach(init);
  };
  const release = (node: Node) => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    [el, ...Array.from(el.querySelectorAll(SEL))].forEach(x => {
      const r = recs.get(x);
      r?.loop?.();
      r?.ai?.();
      r?.enter?.();
      recs.delete(x);
    });
  };

  const mo = new MutationObserver(list => {
    for (const r of list) {
      if (r.type === 'childList') {
        r.addedNodes.forEach(scan);
        r.removedNodes.forEach(n => {
          // React may move nodes; only release if really detached
          if (n.nodeType === 1 && !(n as Element).isConnected) release(n);
        });
      } else if (r.type === 'attributes' && r.target.nodeType === 1) {
        const el = r.target as Element;
        const n = r.attributeName;
        if (n === 'data-m') {
          el.removeAttribute('data-mdone');
          doEnter(el);
        } else if (n === 'data-sp') doSp(el, false);
        else if (n === 'data-loop' || n === 'data-ld') doLoop(el);
      }
    }
  });
  mo.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-m', 'data-sp', 'data-loop', 'data-ld'],
  });
  scan(root);
  return () => mo.disconnect();
}
