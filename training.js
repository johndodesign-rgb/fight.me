// ─────────────────────────────────────────────
// .me Training System · Training engine
// Blocks, dated logs, weekly adjustments, deload, end-of-block review.
// Storage (localStorage):
//   fightme_placement  { track, equipment, date, ... }   (from onboarding)
//   fightme_sessions   [ log entries ]                   (shared with older pages)
//   fightme_block      { id, start, track, equipment, startLevels, history[] }
// ─────────────────────────────────────────────

const TRAINING = (() => {

  const TRAINING_WEEKS = 12;
  const DELOAD_WEEK = 13;
  const PATTERNS = ['push', 'pull', 'squat', 'hinge', 'rotate', 'carry'];
  const PATTERN_LABELS = { push: 'Push', pull: 'Pull', squat: 'Squat', hinge: 'Hinge', rotate: 'Rotate', carry: 'Carry' };
  const TRACKS = ['foundation', 'transition', 'fighter'];
  const TRACK_LABELS = { foundation: 'Foundation', transition: 'Transition', fighter: 'Fighter' };
  const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const WEEK_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Which session runs on which day, and which patterns it trains
  const SCHEDULE = {
    monday:    { type: 'A',        patterns: ['push', 'pull', 'hinge', 'carry'] },
    tuesday:   { type: 'cardio',   patterns: [] },
    thursday:  { type: 'B',        patterns: ['squat', 'push', 'pull', 'rotate'] },
    saturday:  { type: 'C',        patterns: ['hinge', 'push', 'pull', 'carry'] },
    sunday:    { type: 'mobility', patterns: [] },
  };
  const PLANNED_PER_WEEK = Object.keys(SCHEDULE).length;

  // Adjustment thresholds (ratings: 3 = too easy, 2 = about right, 1 = too hard)
  const EASY_AVG = 2.6;
  const HARD_AVG = 1.4;
  const MIN_RATINGS = 2;
  const MIN_LEVEL = -1;
  const MAX_LEVEL = 2;

  // ── STORAGE ──
  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  // ── DATES (local time, YYYY-MM-DD) ──
  function pad(n) { return String(n).padStart(2, '0'); }
  function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function fromKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
  function todayKey() { return toKey(new Date()); }
  function addDays(k, n) { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); }
  function daysBetween(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 86400000); }
  function mondayOf(k) { const d = fromKey(k); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return toKey(d); }
  function dayKeyOf(k) { return DAY_KEYS[fromKey(k).getDay()]; }

  // ── PLACEMENT / BLOCK ──
  function placement() { return read('fightme_placement', null); }

  function block() {
    let b = read('fightme_block', null);
    const p = placement();
    // A retaken assessment starts a fresh block on the new placement
    if (b && b.start && p && p.date && b.placementDate && p.date !== b.placementDate) {
      const fresh = {
        id: (b.id || 1) + 1,
        start: mondayOf(toKey(new Date(p.date))),
        track: p.track || b.track,
        equipment: p.equipment || b.equipment,
        startLevels: {},
        placementDate: p.date,
        history: [...(b.history || []), { id: b.id, start: b.start, track: b.track, endedBy: 'reassessment' }],
      };
      write('fightme_block', fresh);
      return fresh;
    }
    if (b && b.start) return b;
    if (!p) return null;
    // First run on this version: start the block on the Monday of the assessment week
    let start = todayKey();
    if (p.date) { const d = new Date(p.date); if (!isNaN(d)) start = toKey(d); }
    b = {
      id: 1,
      start: mondayOf(start),
      track: p.track || 'foundation',
      equipment: p.equipment || 'dumbbells',
      startLevels: {},
      placementDate: p.date || null,
      history: [],
    };
    write('fightme_block', b);
    return b;
  }

  function saveBlock(b) {
    write('fightme_block', b);
    const p = placement() || {};
    p.track = b.track;
    p.equipment = b.equipment;
    if (!p.date) p.date = new Date().toISOString();
    b.placementDate = p.date;
    write('fightme_block', b);
    write('fightme_placement', p);
  }

  function updateBlock(changes) {
    const b = block();
    if (!b) return null;
    Object.assign(b, changes);
    if (changes.start) b.start = mondayOf(changes.start);
    saveBlock(b);
    return b;
  }

  // Week number of a date inside the current block (1-based; 0 = before the block)
  function weekOf(dateKey, b) {
    b = b || block();
    const diff = daysBetween(b.start, dateKey);
    return diff < 0 ? 0 : Math.floor(diff / 7) + 1;
  }
  function weekStart(weekNum, b) { return addDays((b || block()).start, (weekNum - 1) * 7); }

  // ── LOGS ──
  // Older pages saved { date (ISO), day ('Monday'), feel, patternFeel, ... }.
  // Every entry gets a dateKey and dayKey here so everything can be found by date.
  function normalize(log) {
    const l = { ...log };
    if (!l.dateKey) {
      const d = new Date(l.date);
      l.dateKey = isNaN(d) ? todayKey() : toKey(d);
    }
    if (!l.dayKey) l.dayKey = dayKeyOf(l.dateKey);
    if (!l.source) l.source = 'fit';
    if (!l.patterns) l.patterns = (l.source === 'fit' && SCHEDULE[l.dayKey]) ? SCHEDULE[l.dayKey].patterns : [];
    if (!l.patternFeel) l.patternFeel = {};
    if (!l.flags) l.flags = [];
    if (!l.id) l.id = new Date(l.date || Date.now()).getTime();
    return l;
  }

  function logs() {
    return read('fightme_sessions', []).map(normalize)
      .sort((a, b) => a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : a.id - b.id);
  }

  function saveLog(entry) {
    const all = read('fightme_sessions', []).map(normalize);
    const e = normalize({ ...entry, savedAt: new Date().toISOString() });
    if (!e.date) e.date = fromKey(e.dateKey).toISOString();
    const i = all.findIndex(l => l.id === e.id);
    if (i >= 0) all[i] = e; else all.push(e);
    return write('fightme_sessions', all) ? e : null;
  }

  function deleteLog(id) {
    const all = read('fightme_sessions', []).map(normalize).filter(l => l.id !== id);
    write('fightme_sessions', all);
  }

  function logsOn(dateKey, source) {
    return logs().filter(l => l.dateKey === dateKey && (!source || l.source === source));
  }

  // The program log for a given day (one per day)
  function programLogOn(dateKey) {
    return logsOn(dateKey, 'fit').filter(l => l.kind !== 'extra').pop() || null;
  }

  // ── ADJUSTMENTS ──
  // Ratings for one pattern from one log: the pattern's own rating if given,
  // otherwise the session's overall rating if that session trained the pattern.
  function ratingFor(log, pattern) {
    if (log.source !== 'fit' || log.completion === 'no') return null;
    const own = log.patternFeel && log.patternFeel[pattern];
    if (own >= 1 && own <= 3) return own;
    if (log.patterns.includes(pattern) && log.feel >= 1 && log.feel <= 3) return log.feel;
    return null;
  }

  // Replays each finished week of the block and moves each pattern up or down
  // at most one level per week. Returns levels to use for `uptoWeek` plus the change log.
  function levelsFor(uptoWeek, b) {
    b = b || block();
    const levels = {};
    PATTERNS.forEach(p => { levels[p] = (b.startLevels && b.startLevels[p]) || 0; });
    const changes = [];
    const all = logs();
    const lastScored = Math.min(uptoWeek - 1, TRAINING_WEEKS);

    for (let w = 1; w <= lastScored; w++) {
      const from = weekStart(w, b), to = addDays(from, 7);
      const weekLogs = all.filter(l => l.dateKey >= from && l.dateKey < to);
      PATTERNS.forEach(p => {
        const ratings = weekLogs.map(l => ratingFor(l, p)).filter(r => r !== null);
        if (ratings.length < MIN_RATINGS) return;
        const avg = ratings.reduce((a, c) => a + c, 0) / ratings.length;
        const hurt = weekLogs.some(l => l.flags.includes('something_hurt') && ratingFor(l, p) === 1);
        let dir = 0;
        if (avg <= HARD_AVG || hurt) dir = -1;
        else if (avg >= EASY_AVG) dir = 1;
        else if (levels[p] < 0 && avg >= 2) dir = 1; // easier version now feels right → back to normal
        const next = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, levels[p] + dir));
        if (next !== levels[p]) {
          changes.push({
            week: w + 1, pattern: p, from: levels[p], to: next,
            reason: dir > 0 ? (avg >= EASY_AVG ? `felt too easy in week ${w}` : `easier version felt right in week ${w}`) : hurt ? `something hurt in week ${w}` : `felt too hard in week ${w}`,
          });
          levels[p] = next;
        }
      });
    }
    return { levels, changes };
  }

  // ── STATE ──
  function state(dateKey) {
    const b = block();
    if (!b) return null;
    const d = dateKey || todayKey();
    const week = Math.max(1, weekOf(d, b));
    const phase = week > DELOAD_WEEK ? 'review' : week === DELOAD_WEEK ? 'deload' : 'training';
    return { block: b, week, phase, today: todayKey() };
  }

  // What the generator needs for a given week of the block
  function planContext(weekNum) {
    const st = state();
    if (!st) return { levels: {} };
    const w = weekNum || st.week;
    const { levels } = levelsFor(Math.min(w, DELOAD_WEEK), st.block);
    return { levels, deload: w === DELOAD_WEEK };
  }

  // Generated week for the block's week number
  function plan(weekNum) {
    const st = state();
    const w = Math.max(1, Math.min(weekNum || st.week, DELOAD_WEEK));
    // Deload repeats the week-12 movements
    const genWeek = Math.min(w, TRAINING_WEEKS);
    return PROGRAM_GENERATOR.generateWeek(st.block.track, st.block.equipment, genWeek, planContext(w));
  }

  function sessionOn(dateKey) {
    const st = state();
    const w = weekOf(dateKey, st.block);
    if (w < 1 || w > DELOAD_WEEK) return null;
    return plan(w).sessions[dayKeyOf(dateKey)] || null;
  }

  // ── BLOCK SUMMARY / CONTINUE ──
  function summary(b) {
    b = b || block();
    const end = addDays(b.start, DELOAD_WEEK * 7);
    const blockLogs = logs().filter(l => l.dateKey >= b.start && l.dateKey < end && l.source === 'fit');
    const trainingEnd = addDays(b.start, TRAINING_WEEKS * 7);
    const tLogs = blockLogs.filter(l => l.dateKey < trainingEnd && l.kind !== 'extra');
    const done = tLogs.filter(l => l.completion === 'full').length;
    const partial = tLogs.filter(l => l.completion === 'partial').length;
    const planned = TRAINING_WEEKS * PLANNED_PER_WEEK;
    const feels = tLogs.filter(l => l.feel >= 1 && l.feel <= 3).map(l => l.feel);
    const avgFeel = feels.length ? feels.reduce((a, c) => a + c, 0) / feels.length : null;
    const { levels, changes } = levelsFor(TRAINING_WEEKS + 1, b);
    const completionRate = (done + partial * 0.5) / planned;
    const ti = TRACKS.indexOf(b.track);
    const nextTrack = ti < TRACKS.length - 1 ? TRACKS[ti + 1] : null;
    const readyToMoveUp = !!nextTrack && completionRate >= 0.7 && avgFeel !== null && avgFeel >= 1.8;
    return { start: b.start, end, done, partial, planned, completionRate, avgFeel, levels, changes, nextTrack, readyToMoveUp };
  }

  // Start the next block. mode: 'next' (move up a track) or 'repeat' (same track, keep progress)
  function startNextBlock(mode, startKey) {
    const b = block();
    const s = summary(b);
    const newTrack = mode === 'next' && s.nextTrack ? s.nextTrack : b.track;
    const carry = {};
    if (newTrack === b.track) {
      // Repeating: keep what you earned, but never start a block on a regression
      PATTERNS.forEach(p => { carry[p] = Math.max(0, s.levels[p] || 0); });
    }
    const next = {
      id: (b.id || 1) + 1,
      start: mondayOf(startKey || todayKey()),
      track: newTrack,
      equipment: b.equipment,
      startLevels: carry,
      history: [...(b.history || []), {
        id: b.id, start: b.start, track: b.track,
        done: s.done, partial: s.partial, planned: s.planned, endLevels: s.levels,
      }],
    };
    saveBlock(next);
    return next;
  }

  // ── BACKUP ──
  function exportData() {
    return JSON.stringify({
      exported: new Date().toISOString(),
      placement: placement(),
      block: read('fightme_block', null),
      sessions: read('fightme_sessions', []),
    }, null, 2);
  }
  function importData(json) {
    const d = JSON.parse(json);
    if (!d || !Array.isArray(d.sessions)) throw new Error('Not a fight.me backup file');
    if (d.placement) write('fightme_placement', d.placement);
    if (d.block) write('fightme_block', d.block);
    write('fightme_sessions', d.sessions);
  }

  return {
    TRAINING_WEEKS, DELOAD_WEEK, PATTERNS, PATTERN_LABELS, TRACKS, TRACK_LABELS, SCHEDULE, WEEK_ORDER,
    todayKey, toKey, fromKey, addDays, daysBetween, mondayOf, dayKeyOf,
    placement, block, updateBlock, weekOf, weekStart,
    logs, saveLog, deleteLog, logsOn, programLogOn,
    levelsFor, state, planContext, plan, sessionOn,
    summary, startNextBlock, exportData, importData,
  };
})();

if (typeof module !== 'undefined') module.exports = TRAINING;
