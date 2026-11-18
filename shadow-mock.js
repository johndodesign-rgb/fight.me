// ─────────────────────────────────────────────
// fight.me · Simulated boxer for testing shadow.html without a camera.
// Open shadow.html?mock to use it. Produces MoveNet-style keypoints in raw
// front-camera image coordinates (the boxer's left side is on the image's right).
// ─────────────────────────────────────────────

function createMockBoxer(W, H, opts = {}) {
  const o = {
    slowLead: 0.45,      // share of lead punches that come back slow
    rearDrop: 0.35,      // share of lead punches where the rear hand drops
    reaction: 0.45,      // seconds from call to first punch
    missCall: 0.1,       // share of calls ignored
    headSway: 0.08,      // torso units
    startClose: true,    // begin too close and off-center, then step back
    ...opts,
  };
  const queue = [];       // scheduled punches { hand, t0, kind, slow, drop }
  let start = null;
  let rnd = 1;
  const rand = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };

  const OUT = 0.17, HOLD = 0.04;

  function schedule(hand, t0, kind = 'straight') {
    const slow = hand === 'lead' && rand() < o.slowLead;
    const drop = hand === 'lead' && rand() < o.rearDrop;
    queue.push({ hand, t0, kind, slow, drop, back: slow ? 0.65 : 0.2 });
  }

  // Extension 0..1 for a punch at time t
  function ext(p, t) {
    const dt = t - p.t0;
    if (dt < 0) return 0;
    if (dt < OUT) return dt / OUT;
    if (dt < OUT + HOLD) return 1;
    if (dt < OUT + HOLD + p.back) return 1 - (dt - OUT - HOLD) / p.back;
    return 0;
  }

  return {
    // React to a called combo, e.g. hands ['lead','rear']
    call(hands, t) {
      if (rand() < o.missCall) return;
      let tt = t + o.reaction + rand() * 0.15;
      hands.forEach(h => { schedule(h, tt); tt += 0.32; });
    },
    throwN(hand, n, t, gap = 0.9) { for (let i = 0; i < n; i++) schedule(hand, t + 0.4 + i * gap); },
    pose(t) {
      if (start === null) start = t;
      const age = t - start;
      // Position: too close + off to one side at first, then step into place
      const settle = o.startClose ? Math.min(1, Math.max(0, (age - 2.5) / 1.2)) : 1;
      const share = 0.97 - 0.27 * settle;
      const u = (share * H) / 3.0;
      const cx = W * (0.78 - 0.28 * settle) + Math.sin(t * 0.7) * 0.25 * u;
      const footY = H * 0.93;

      const j = () => (rand() - 0.5) * 0.02 * u;
      const P = (x, y, s = 0.85) => ({ x: x + j(), y: y + j(), score: s - rand() * 0.08 });

      const hipY = footY - 1.55 * u, shY = hipY - u, noseY = shY - 0.45 * u;
      const sway = Math.sin(t * 2.1) * o.headSway * u;
      const nose = { x: cx + sway, y: noseY };

      // Punches in progress
      let le = 0, re = 0, rearDrop = 0;
      for (let i = queue.length - 1; i >= 0; i--) {
        const p = queue[i];
        const e = ext(p, t);
        if (t - p.t0 > 3) { queue.splice(i, 1); continue; }
        if (p.hand === 'lead') { le = Math.max(le, e); if (p.drop) rearDrop = Math.max(rearDrop, e); }
        else re = Math.max(re, e);
      }
      // Guard spots (lead = boxer's left = image right)
      const lg = { x: nose.x + 0.28 * u, y: nose.y + 0.38 * u };
      const rg = { x: nose.x - 0.16 * u, y: nose.y + 0.32 * u };
      const lw = { x: lg.x + 0.95 * u * le, y: lg.y - 0.08 * u * le };
      const rw = { x: rg.x + 1.15 * u * re, y: rg.y - 0.05 * u * re + 0.55 * u * rearDrop };

      const ls = { x: cx + 0.27 * u, y: shY }, rs = { x: cx - 0.27 * u, y: shY };
      const lh = { x: cx + 0.2 * u, y: hipY }, rh = { x: cx - 0.2 * u, y: hipY };
      const la = { x: cx + 0.55 * u, y: footY }, ra = { x: cx - 0.55 * u, y: footY };
      const elbow = (s, w, side) => ({ x: (s.x + w.x) / 2 + side * 0.05 * u, y: (s.y + w.y) / 2 + 0.25 * u });

      const kp = [
        P(nose.x, nose.y), P(nose.x + 0.06 * u, nose.y - 0.05 * u), P(nose.x - 0.06 * u, nose.y - 0.05 * u),
        P(nose.x + 0.12 * u, nose.y), P(nose.x - 0.12 * u, nose.y),
        P(ls.x, ls.y), P(rs.x, rs.y),
        P(elbow(ls, lw, 1).x, elbow(ls, lw, 1).y), P(elbow(rs, rw, -1).x, elbow(rs, rw, -1).y),
        P(lw.x, lw.y), P(rw.x, rw.y),
        P(lh.x, lh.y), P(rh.x, rh.y),
        P((lh.x + la.x) / 2, (lh.y + la.y) / 2), P((rh.x + ra.x) / 2, (rh.y + ra.y) / 2),
        P(la.x, Math.min(la.y, H * 0.999), la.y > H * 0.985 ? 0.2 : 0.85), P(ra.x, Math.min(ra.y, H * 0.999), ra.y > H * 0.985 ? 0.2 : 0.85),
      ];
      // Head cut off when too close
      if (nose.y < H * 0.03) [0, 1, 2, 3, 4].forEach(i => { kp[i].score = 0.1; });
      return kp;
    },
  };
}

if (typeof module !== 'undefined') module.exports = createMockBoxer;
