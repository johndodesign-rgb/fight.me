// ─────────────────────────────────────────────
// fight.me · Shadowboxing engine
// Pure logic: takes pose keypoints (MoveNet order, image pixels) and turns
// them into framing guidance, a guard baseline, punch events, round stats
// and between-round feedback. No camera or DOM code in here.
//
// Everything is measured in "torso units" (shoulder-center to hip-center),
// relative to your nose, so it doesn't matter how far from the phone you
// stand or how tall you are.
// ─────────────────────────────────────────────

const SHADOW = (() => {

  const K = { nose: 0, ls: 5, rs: 6, le: 7, re: 8, lw: 9, rw: 10, lh: 11, rh: 12, lk: 13, rk: 14, la: 15, ra: 16 };
  const MIN = 0.3;

  // ── COMBOS ──
  // 1 jab · 2 cross · 3 lead hook · 4 rear hook · 5 lead uppercut · 6 rear uppercut
  const FOCUS = {
    jabcross: { label: 'Jab & cross', desc: 'Straight punches — the 1 and the 2', calls: ['1', '1', '1-1', '1-2', '1-2', '1-1-2', '2', '1-2-1'] },
    hooks:    { label: 'Add the hook', desc: 'Straights plus the lead hook', calls: ['1-2', '1-2-3', '3', '1-3', '1-1-3', '3-2', '1-2-3-2'] },
    uppers:   { label: 'Uppercuts', desc: 'Close-range shots off the straights', calls: ['1-6', '5-2', '1-2-5', '6-3', '1-6-3-2', '2-5-2'] },
    mix:      { label: 'Mix it up', desc: 'Everything, short and long', calls: ['1', '1-2', '1-1-2', '1-2-3', '3-2', '1-6-3', '5-2', '1-2-3-2', '2-3-2', '1-1'] },
    free:     { label: 'Free round', desc: 'No calls — your own rhythm', calls: [] },
  };
  const NUM_WORDS = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six' };
  const NAME_WORDS = { 1: 'jab', 2: 'cross', 3: 'hook', 4: 'back hook', 5: 'upper', 6: 'back upper' };
  const handOf = n => (Number(n) % 2 === 1 ? 'lead' : 'rear');

  function comboInfo(combo, style) {
    const nums = combo.split('-');
    const words = style === 'names' ? NAME_WORDS : NUM_WORDS;
    return { combo, n: nums.length, hands: nums.map(handOf), speech: nums.map(x => words[x]).join(' '), display: nums.join(' · ') };
  }

  // Time until the next call, given the last one
  function nextCallGap(n, rand = Math.random) { return 1.3 + 0.55 * n + 0.6 + rand() * 1.6; }

  // ── GEOMETRY ──
  const ok = p => p && p.score >= MIN;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function geom(kp) {
    const g = { valid: false };
    if (!kp || !ok(kp[K.ls]) || !ok(kp[K.rs]) || !ok(kp[K.lh]) || !ok(kp[K.rh]) || !ok(kp[K.nose])) return g;
    const sm = mid(kp[K.ls], kp[K.rs]);
    const hm = mid(kp[K.lh], kp[K.rh]);
    const unit = dist(sm, hm);
    if (unit < 5) return g;
    g.valid = true;
    g.unit = unit;
    g.nose = kp[K.nose];
    g.hipMid = hm;
    g.shoulderRatio = dist(kp[K.ls], kp[K.rs]) / unit;
    g.wrist = {
      left: ok(kp[K.lw]) ? { x: (kp[K.lw].x - g.nose.x) / unit, y: (kp[K.lw].y - g.nose.y) / unit } : null,
      right: ok(kp[K.rw]) ? { x: (kp[K.rw].x - g.nose.x) / unit, y: (kp[K.rw].y - g.nose.y) / unit } : null,
    };
    g.stance = ok(kp[K.la]) && ok(kp[K.ra]) ? dist(kp[K.la], kp[K.ra]) / unit : null;
    g.headX = (g.nose.x - hm.x) / unit;
    return g;
  }

  // ── SMOOTHING ──
  // Light smoothing: punches are fast, so too much smoothing hides them.
  function makeSmoother(alpha = 0.6) {
    let prev = null;
    return kp => {
      if (!kp) return prev;
      if (!prev) { prev = kp.map(p => ({ ...p })); return prev; }
      prev = kp.map((p, i) => {
        const q = prev[i];
        if (p.score < 0.15) return { ...q, score: q.score * 0.7 };
        if (q.score < 0.15) return { ...p };
        return { x: q.x + alpha * (p.x - q.x), y: q.y + alpha * (p.y - q.y), score: p.score, name: p.name };
      });
      return prev;
    };
  }

  // ── FRAMING ──
  // Returns the checks plus the single most useful instruction.
  // Directions are from the boxer's point of view (front camera faces them).
  function assessFrame(kp, W, H) {
    const checks = [
      { id: 'body', label: 'Whole body in view', ok: false },
      { id: 'distance', label: 'Distance', ok: false },
      { id: 'center', label: 'Centered', ok: false },
      { id: 'hands', label: 'Both hands visible', ok: false },
      { id: 'light', label: 'Light', ok: false },
    ];
    const set = (id, v) => { checks.find(c => c.id === id).ok = v; };
    let say = null;
    const first = s => { if (!say) say = s; };

    if (!kp || !ok(kp[K.ls]) || !ok(kp[K.rs]) || !ok(kp[K.lh]) || !ok(kp[K.rh])) {
      return { checks, ready: false, instruction: 'Step into view. Stand 6 to 8 feet from the phone.' };
    }
    const nose = kp[K.nose];
    const feet = [kp[K.la], kp[K.ra]];
    const feetOk = feet.every(ok) && feet.every(p => p.y < H * 0.985);
    const headOk = ok(nose) && nose.y > H * 0.04;

    // Body: head and both feet visible
    set('body', feetOk && headOk);
    if (!feetOk && headOk) first('I can’t see your feet. Step back, or tilt the phone down a little.');
    if (!headOk && feetOk) first('I can’t see your head. Step back, or tilt the phone up a little.');
    if (!headOk && !feetOk) first('Step back so I can see you from head to feet.');

    // Distance: nose-to-feet height as a share of the frame
    const footY = feetOk ? Math.max(feet[0].y, feet[1].y) : H;
    const topY = headOk ? nose.y : 0;
    const bodyShare = (footY - topY) / H;
    const distOk = bodyShare >= 0.45 && bodyShare <= 0.85;
    set('distance', distOk && feetOk && headOk);
    if (feetOk && headOk) {
      if (bodyShare > 0.85) first('Take a step back.');
      else if (bodyShare < 0.45) first('Take a step closer.');
    }

    // Center (raw image: your right side is on the image’s left)
    const hx = (kp[K.lh].x + kp[K.rh].x) / 2 / W;
    const centered = hx >= 0.3 && hx <= 0.7;
    set('center', centered);
    if (!centered) first(hx < 0.3 ? 'Step to your left.' : 'Step to your right.');

    // Hands
    const handsOk = ok(kp[K.lw]) && ok(kp[K.rw]);
    const g = geom(kp);
    set('hands', handsOk && g.valid && g.shoulderRatio >= 0.28);
    if (!handsOk) first('Hands up where I can see them.');
    else if (g.valid && g.shoulderRatio < 0.28) first('Turn your chest a little more toward the phone. I can’t see your back hand.');

    // Light: average confidence of the main joints
    const main = [K.nose, K.ls, K.rs, K.lw, K.rw, K.lh, K.rh, K.la, K.ra].map(i => kp[i] ? kp[i].score : 0);
    const avg = main.reduce((a, c) => a + c, 0) / main.length;
    set('light', avg >= 0.45);
    if (avg < 0.45) first('It’s hard to see you. Add light, or stand in front of a plain wall.');

    const ready = checks.every(c => c.ok);
    return { checks, ready, instruction: ready ? 'Good. Hold it there.' : say, bodyShare };
  }

  // ── GUARD BASELINE ──
  // Collect frames while you hold your guard. Returns null until you've been still long enough.
  function makeGuardCapture(holdSec = 1.5) {
    let frames = [];
    return {
      update(kp, t) {
        const g = geom(kp);
        if (!g.valid || !g.wrist.left || !g.wrist.right) { frames = []; return { progress: 0 }; }
        frames.push({ t, g });
        while (frames.length && t - frames[0].t > holdSec) frames.shift();
        const span = frames.length > 1 ? frames[frames.length - 1].t - frames[0].t : 0;
        // Still = wrists not moving much relative to the nose
        const spread = side => {
          const xs = frames.map(f => f.g.wrist[side].x), ys = frames.map(f => f.g.wrist[side].y);
          return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
        };
        const still = spread('left') < 0.22 && spread('right') < 0.22;
        // Guard = both wrists above the hips and near the face
        const up = ['left', 'right'].every(s => frames[frames.length - 1].g.wrist[s].y < 1.05);
        if (!still || !up) { frames = frames.slice(-2); return { progress: 0, reason: !up ? 'hands' : 'moving' }; }
        const progress = Math.min(1, span / (holdSec - 0.1));
        if (progress < 1) return { progress };
        const avg = f => frames.reduce((a, x) => a + f(x.g), 0) / frames.length;
        const stances = frames.map(f => f.g.stance).filter(s => s !== null);
        return {
          progress: 1,
          baseline: {
            guard: {
              left: { x: avg(g => g.wrist.left.x), y: avg(g => g.wrist.left.y) },
              right: { x: avg(g => g.wrist.right.x), y: avg(g => g.wrist.right.y) },
            },
            stance: stances.length ? stances.reduce((a, c) => a + c, 0) / stances.length : null,
            shoulderRatio: avg(g => g.shoulderRatio),
          },
        };
      },
      reset() { frames = []; },
    };
  }

  // How far a wrist is from its guard spot, in torso units
  function displacement(g, base, side) {
    const w = g.wrist[side];
    if (!w) return null;
    return Math.hypot(w.x - base.guard[side].x, w.y - base.guard[side].y);
  }

  // ── PUNCH DETECTOR (one hand) ──
  function makeHandDetector(opts) {
    const o = { start: 0.35, back: 0.2, maxOut: 1.4, rise: 0.4, ...opts };
    let state = 'idle', cur = null, lastLow = 0, minSincePeak = Infinity;
    return {
      update(d, t) {
        const events = [];
        if (d === null) return events;
        if (state === 'idle') {
          if (d < o.back) lastLow = t;
          if (d > o.start) {
            if (t - lastLow > o.rise) state = 'away';         // slow drift, not a punch
            else { state = 'out'; cur = { t0: t, peak: d, tPeak: t }; minSincePeak = Infinity; }
          }
        } else if (state === 'out') {
          if (d > cur.peak && minSincePeak === Infinity) { cur.peak = d; cur.tPeak = t; }
          if (d < cur.peak) minSincePeak = Math.min(minSincePeak, d);
          if (d < o.back) {
            events.push({ ...cur, t1: t, returned: true, returnTime: t - cur.tPeak });
            state = 'idle'; lastLow = t; cur = null;
          } else if (minSincePeak < cur.peak * 0.8 && d - minSincePeak > 0.15) {
            // Threw again before getting all the way back
            events.push({ ...cur, t1: t, returned: false, rethrow: true, returnTime: t - cur.tPeak });
            cur = { t0: t, peak: d, tPeak: t }; minSincePeak = Infinity;
          } else if (t - cur.t0 > o.maxOut) {
            // Hand stayed out — count the punch, mark it as not coming back
            events.push({ ...cur, t1: t, returned: false, returnTime: t - cur.tPeak });
            state = 'away'; cur = null;
          }
        } else if (state === 'away') {
          if (d < o.back) { state = 'idle'; lastLow = t; }
        }
        return events;
      },
      get active() { return state === 'out'; },
      get away() { return state === 'away'; },
    };
  }

  // ── CALIBRATION ──
  // "Throw three jabs, then three crosses." Works out which hand is your lead
  // and how big your punches look from where the phone is.
  function makeCalibrator(base) {
    const det = { left: makeHandDetector({ start: 0.3, back: 0.18 }), right: makeHandDetector({ start: 0.3, back: 0.18 }) };
    const peaks = { left: [], right: [] };
    let step = 'jab', lead = null, offFrame = 0;
    return {
      get step() { return step; },
      update(kp, t, W, H) {
        const g = geom(kp);
        if (!g.valid) return { step };
        // Wrist near the edge of the frame = punches leaving the picture
        [K.lw, K.rw].forEach(i => { const p = kp[i]; if (p && (p.x < W * 0.02 || p.x > W * 0.98 || p.y < H * 0.02)) offFrame++; });
        for (const side of ['left', 'right']) {
          const d = displacement(g, base, side);
          det[side].update(d, t).forEach(e => peaks[side].push(e.peak));
        }
        if (step === 'jab') {
          const s = peaks.left.length >= 3 ? 'left' : peaks.right.length >= 3 ? 'right' : null;
          if (s) {
            lead = s;
            const other = s === 'left' ? 'right' : 'left';
            peaks[other] = [];
            step = 'cross';
            return { step, justFinished: 'jab', lead };
          }
          return { step, count: Math.max(peaks.left.length, peaks.right.length) };
        }
        if (step === 'cross') {
          const rear = lead === 'left' ? 'right' : 'left';
          if (peaks[rear].length >= 3) {
            step = 'done';
            const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
            const leadPeak = avg(peaks[lead].slice(0, 3)), rearPeak = avg(peaks[rear].slice(0, 3));
            const small = Math.min(leadPeak, rearPeak);
            return {
              step,
              lead,
              stance: lead === 'left' ? 'orthodox' : 'southpaw',
              leadPeak, rearPeak,
              tooSmall: small < 0.5,
              offFrame: offFrame > 3,
              thresholds: { start: Math.max(0.3, small * 0.42), back: Math.max(0.17, small * 0.22) },
            };
          }
          return { step, count: peaks[rear].length };
        }
        return { step };
      },
    };
  }

  // ── ROUND TRACKER ──
  function makeTracker(base, calib) {
    const sideOf = { lead: calib.lead, rear: calib.lead === 'left' ? 'right' : 'left' };
    const det = { lead: makeHandDetector(calib.thresholds), rear: makeHandDetector(calib.thresholds) };
    let round = null;
    let lastPunchT = -10;
    const otherMax = { lead: 0, rear: 0 };

    function startRound(t, meta = {}) {
      round = { t0: t, t1: null, meta, punches: [], calls: [], frames: 0, seen: 0, idle: 0, drift: 0, stanceN: 0, narrow: 0, headX: [] };
      lastPunchT = -10;
    }

    function addCall(t, info) { if (round) round.calls.push({ t, ...info }); }

    function update(kp, t) {
      if (!round) return [];
      round.frames++;
      const g = geom(kp);
      if (!g.valid) return [];
      round.seen++;
      const out = [];
      for (const hand of ['lead', 'rear']) {
        const side = sideOf[hand];
        const d = displacement(g, base, side);
        // While this hand is out, track how far the other hand drops from its guard
        const otherSide = side === 'left' ? 'right' : 'left';
        const ow = g.wrist[otherSide];
        const events = det[hand].update(d, t);
        if (det[hand].active && ow) otherMax[hand] = Math.max(otherMax[hand], ow.y - base.guard[otherSide].y);
        events.forEach(e => {
          const dropped = otherMax[hand] > calib.thresholds.start * 0.85;
          otherMax[hand] = det[hand].active && ow ? Math.max(0, ow.y - base.guard[otherSide].y) : 0;
          const p = { ...e, hand, otherDropped: dropped };
          round.punches.push(p);
          out.push(p);
          lastPunchT = t;
        });
      }
      const busy = det.lead.active || det.rear.active || t - lastPunchT < 0.35;
      if (!busy) {
        round.idle++;
        const low = ['left', 'right'].some(s => g.wrist[s] && (g.wrist[s].y - base.guard[s].y) > calib.thresholds.start * 0.85);
        if (low || det.lead.away || det.rear.away) round.drift++;
      }
      if (g.stance !== null && base.stance) {
        round.stanceN++;
        if (g.stance < base.stance * 0.65) round.narrow++;
      }
      round.headX.push(g.headX);
      return out;
    }

    function endRound(t) {
      if (!round) return null;
      round.t1 = t;
      const r = round;
      round = null;
      return summarize(r);
    }

    return { startRound, addCall, update, endRound, get inRound() { return !!round; } };
  }

  // ── ROUND SUMMARY ──
  function pct(a, b) { return b ? a / b : 0; }
  function quantile(arr, q) { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }

  function summarize(r) {
    const dur = Math.max(1, r.t1 - r.t0);
    const P = [...r.punches].sort((a, b) => a.t0 - b.t0);   // detected on return; order by when they were thrown
    const byHand = h => P.filter(p => p.hand === h);
    const slow = p => (!p.returned && !p.rethrow) || (p.returned && p.returnTime > 0.45);
    const half = r.t0 + dur / 2;

    // Match punches to calls
    let responded = 0, clean = 0; const reactions = [];
    const used = new Set();
    r.calls.forEach((c, i) => {
      const next = r.calls[i + 1] ? r.calls[i + 1].t : Infinity;
      const end = Math.min(next, c.t + 1.0 + 0.5 * c.n);
      const got = P.filter((p, j) => !used.has(j) && p.t0 >= c.t - 0.1 && p.t0 <= end);
      got.forEach(p => used.add(P.indexOf(p)));
      if (got.length >= Math.max(1, Math.ceil(c.n * 0.6))) {
        responded++;
        reactions.push(got[0].t0 - c.t);
        if (got.length >= c.n && c.hands.every((h, k) => got[k] && got[k].hand === h)) clean++;
      }
    });

    const hands = {};
    for (const h of ['lead', 'rear']) {
      const ps = byHand(h);
      hands[h] = {
        count: ps.length,
        slow: ps.filter(slow).length,
        otherDropped: ps.filter(p => p.otherDropped).length,
        avgReturn: ps.filter(p => p.returned).length ? ps.filter(p => p.returned).reduce((a, p) => a + p.returnTime, 0) / ps.filter(p => p.returned).length : null,
      };
    }

    const expected = r.calls.reduce((a, c) => a + c.n, 0);
    return {
      seconds: Math.round(dur),
      expected,
      workRatio: expected ? P.length / expected : null,
      visibleShare: pct(r.seen, r.frames),
      punches: P.length,
      perMin: Math.round(P.length / (dur / 60)),
      firstHalf: P.filter(p => p.t0 < half).length,
      secondHalf: P.filter(p => p.t0 >= half).length,
      hands,
      slowShare: pct(P.filter(slow).length, P.length),
      driftShare: pct(r.drift, r.idle),
      narrowShare: r.stanceN > 20 ? pct(r.narrow, r.stanceN) : null,
      headRange: r.headX.length > 20 ? quantile(r.headX, 0.9) - quantile(r.headX, 0.1) : null,
      calls: r.calls.length,
      responded,
      clean,
      reaction: reactions.length ? reactions.reduce((a, c) => a + c, 0) / reactions.length : null,
      free: r.calls.length === 0,
    };
  }

  // ── FEEDBACK ──
  const HAND_NAME = { lead: 'lead hand', rear: 'rear hand' };

  function faults(s) {
    const f = [];
    if (s.punches < 4) return f;
    for (const h of ['lead', 'rear']) {
      const x = s.hands[h];
      if (x.count >= 4 && x.slow / x.count > 0.35) f.push({
        id: `return-${h}`, score: (x.slow / x.count) * 1.0, metric: x.slow / x.count,
        text: `Your ${HAND_NAME[h]} is coming back slow. ${x.slow} of ${x.count} hung out there. Bring it back the same way it went out.`,
        stat: `${x.slow} of ${x.count} still hung out there`, tip: 'Bring it back the same way it went out.',
        cue: `bring the ${HAND_NAME[h]} straight back`, area: `getting the ${HAND_NAME[h]} back`,
      });
      const other = h === 'lead' ? 'rear' : 'lead';
      if (x.count >= 4 && x.otherDropped / x.count > 0.3) f.push({
        id: `drop-${other}`, score: (x.otherDropped / x.count) * 1.0, metric: x.otherDropped / x.count,
        text: `Your ${HAND_NAME[other]} drops when you throw with the ${HAND_NAME[h]}. ${x.otherDropped} of ${x.count} times. Keep it glued to your cheek.`,
        stat: `it still dropped ${x.otherDropped} of ${x.count} times`, tip: 'Keep it glued to your cheek.',
        cue: `keep the ${HAND_NAME[other]} on your cheek`, area: `keeping the ${HAND_NAME[other]} up`,
      });
    }
    if (s.driftShare > 0.3) f.push({ id: 'drift', score: s.driftShare * 0.8, metric: s.driftShare,
      text: 'Your hands are drifting down between combos. Reset to your guard after every one.', cue: 'hands back up after every combo', area: 'your guard between combos' });
    if (s.calls >= 4 && s.responded / s.calls < 0.7) f.push({ id: 'calls', score: (1 - s.responded / s.calls) * 0.7, metric: 1 - s.responded / s.calls,
      text: `You let ${s.calls - s.responded} calls go by. Throw as soon as you hear it, even if it isn’t perfect.`, cue: 'throw the second you hear it', area: 'answering the calls' });
    if (s.responded >= 4 && s.clean / s.responded < 0.6) f.push({ id: 'combo', score: (1 - s.clean / s.responded) * 0.6, metric: 1 - s.clean / s.responded,
      text: 'The combos are coming out short or in the wrong order. Finish the whole combo before you reset.', cue: 'finish the whole combo', area: 'finishing the combos' });
    if (s.narrowShare !== null && s.narrowShare > 0.3) f.push({ id: 'feet', score: s.narrowShare * 0.6, metric: s.narrowShare,
      text: 'Your feet are coming together. Keep your stance width when you move.', cue: 'keep your feet wide', area: 'your stance width' });
    if (s.headRange !== null && s.headRange < 0.12 && s.punches >= 8) f.push({ id: 'head', score: 0.35, metric: 0.12 - s.headRange,
      text: 'Your head is staying on the center line. Move it after you throw — a slip or a roll before you reset.', cue: 'move your head after you throw', area: 'head movement' });
    if (s.free && s.perMin < 25) f.push({ id: 'output', score: 0.3, metric: 25 - s.perMin,
      text: `Work rate is low, about ${s.perMin} punches a minute. Aim for a punch every two seconds.`, cue: 'more punches', area: 'work rate' });
    return f.sort((a, b) => b.score - a.score);
  }

  function positives(s, prev) {
    const p = [];
    if (prev && prev.punches >= 4 && s.free && prev.free && s.perMin > prev.perMin * 1.15) p.push(`Work rate went up, ${s.perMin} punches a minute.`);
    const ret = 1 - s.slowShare;
    if (s.punches >= 6 && ret >= 0.85) p.push(`Hands came back on ${s.punches - Math.round(s.slowShare * s.punches)} of ${s.punches} punches.`);
    if (s.reaction !== null && s.responded >= 3 && s.reaction < 0.7) p.push(`You were quick off the calls, about ${s.reaction.toFixed(1)} seconds.`);
    if (s.responded >= 4 && s.clean / s.responded >= 0.8) p.push('Combos came out complete and in order.');
    if (s.headRange !== null && s.headRange > 0.3) p.push('Good head movement.');
    if (s.driftShare < 0.1 && s.punches >= 6) p.push('Guard stayed tight between combos.');
    return p;
  }

  // focusPrev: the fault id you were told to work on last round
  function roundFeedback(s, prev, focusPrev, roundNum, totalRounds) {
    const F = faults(s);
    const pos = positives(s, prev);
    let lead = null;

    if (s.visibleShare < 0.5) {
      return { focus: null, positive: null, text: 'I lost sight of you for a lot of that round. Stay inside the frame next round.', speech: 'I lost sight of you for a lot of that round. Stay inside the frame.' };
    }

    // Did last round’s fix get better?
    if (focusPrev && prev) {
      const before = faults(prev).find(f => f.id === focusPrev.id);
      const now = F.find(f => f.id === focusPrev.id);
      if (before && (!now || now.metric < before.metric * 0.75)) lead = `That’s better on ${focusPrev.area}.`;
      else if (now) lead = `Keep working on ${focusPrev.area}.`;
    }

    // Pick the correction — don’t repeat a fixed one, prefer a new one if last is still there but another is worse
    let focus = F[0] || null;
    if (focusPrev) {
      const still = F.find(f => f.id === focusPrev.id);
      const improved = lead && lead.startsWith('That’s better');
      // Stick with one fix until it improves, unless something else is much worse
      if (still && !improved && !(F[0].score > still.score * 1.5)) focus = still;
      if (improved && focus && focus.id === focusPrev.id) focus = F.find(f => f.id !== focusPrev.id) || null;
    }

    const good = !lead || !lead.startsWith('That’s better') ? pos[0] : null;
    const parts = [];
    if (lead) parts.push(lead);
    const keep = focus && focusPrev && focus.id === focusPrev.id && lead && lead.startsWith('Keep working');
    if (good && !keep) parts.push(good);
    const sameFix = focus && focusPrev && focus.id === focusPrev.id && lead && lead.startsWith('Keep working');
    if (sameFix) {
      parts[parts.length - 1] = focus.stat ? `Keep working on ${focus.area}: ${focus.stat}. ${focus.tip}` : `Keep working on ${focus.area}. ${focus.text}`;
      if (good) parts.push(good);
    } else if (focus) parts.push(focus.text);
    if (!focus && !lead) parts.push(s.punches < 4 ? 'I only saw a few punches that round. Let your hands go next round.' : 'Clean round. Keep the same rhythm.');
    const last = roundNum >= totalRounds;
    if (focus && !last) parts.push(`Next round: ${focus.cue}.`);
    const text = parts.join(' ');
    return { focus, positive: good, text, speech: text };
  }

  // ── SESSION SUMMARY ──
  function sessionSummary(rounds, feedbacks) {
    const R = rounds.filter(Boolean);
    const total = R.reduce((a, r) => a + r.punches, 0);
    const first = R[0], last = R[R.length - 1];
    // Fade: on called rounds, compare how much of each call you threw and how fast you reacted;
    // on free rounds, compare punches per minute.
    let fade = 0;
    if (R.length >= 2) {
      if (first.workRatio && last.workRatio) {
        fade = 1 - last.workRatio / first.workRatio;
        if (first.reaction !== null && last.reaction !== null && last.reaction - first.reaction > 0.25) fade = Math.max(fade, 0.3);
      } else if (first.perMin >= 15) fade = 1 - last.perMin / first.perMin;
    }
    const counts = {};
    R.forEach(r => faults(r).forEach(f => { counts[f.id] = (counts[f.id] || 0) + 1; }));
    const recurring = Object.entries(counts).filter(([, n]) => n >= Math.max(2, Math.ceil(R.length / 2))).map(([id]) => id);
    const flags = [];
    if (fade > 0.25) flags.push('gassed_out');
    if (recurring.some(id => id.startsWith('drop-') || id === 'drift')) flags.push('hands_dropped');
    const laterOnly = R.length >= 2 && faults(first).length === 0 && faults(last).length > 0;
    if (laterOnly) flags.push('form_broke');
    const topFix = (() => {
      const all = R.flatMap(r => faults(r));
      const byId = {};
      all.forEach(f => { byId[f.id] = byId[f.id] || { ...f, n: 0 }; byId[f.id].n++; });
      return Object.values(byId).sort((a, b) => b.n - a.n || b.score - a.score)[0] || null;
    })();
    return { rounds: R.length, total, fade, flags, recurring, topFix };
  }

  return {
    K, FOCUS, comboInfo, nextCallGap, handOf,
    geom, makeSmoother, assessFrame, makeGuardCapture, makeCalibrator, makeTracker,
    makeHandDetector, displacement, summarize, faults, roundFeedback, sessionSummary,
  };
})();

if (typeof module !== 'undefined') module.exports = SHADOW;
