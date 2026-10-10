/**
 * Thin wrapper around Motion (the vanilla-JS build of Framer Motion).
 * If the CDN is blocked or the person prefers reduced motion, everything still works, just without animation.
 */
(function (root) {
  'use strict';

  const M = root.Motion;
  const reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canAnimate = !!(M && M.animate) && !reduced;

  /** The one orchestrated moment: page-load sequence. */
  function intro(elements) {
    const els = elements.filter(Boolean);
    if (!canAnimate) return;
    M.animate(els, { opacity: [0, 1], y: [14, 0] }, { duration: 0.55, ease: 'easeOut', delay: M.stagger ? M.stagger(0.08) : 0 });
  }

  /** Appears in response to a person's action (panel opens, field reveals, list item added). */
  function enter(el) {
    if (!el || !canAnimate) return;
    M.animate(el, { opacity: [0, 1], y: [8, 0] }, { duration: 0.32, ease: 'easeOut' });
  }

  /** Slides the selector thumb to the chosen option. */
  function moveThumb(thumb, rect, instant) {
    const props = { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' };
    if (!canAnimate || instant) {
      Object.assign(thumb.style, props);
      return;
    }
    thumb.style.transition = 'none';
    M.animate(thumb, props, { type: 'spring', stiffness: 420, damping: 34 });
  }

  /** Small pulse to confirm success. */
  function pop(el) {
    if (!el || !canAnimate) return;
    M.animate(el, { scale: [0.6, 1.08, 1] }, { duration: 0.5, ease: 'easeOut' });
  }

  root.CCMotion = { intro, enter, moveThumb, pop, canAnimate };
})(window);
