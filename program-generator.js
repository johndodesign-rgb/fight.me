// ─────────────────────────────────────────────
// .me Training System · Program Generator
// Takes: track, week, equipment, sessionLogs
// Returns: personalized weekly program
// ─────────────────────────────────────────────

const PROGRAM_GENERATOR = (() => {

  // ── EQUIPMENT TIERS ──
  const EQUIPMENT = {
    bodyweight:    ['Bodyweight'],
    bands:         ['Bodyweight', 'Band'],
    dumbbells:     ['Bodyweight', 'Band', 'Dumbbells', 'Dumbbell', 'Dumbbells, Bench', 'Dumbbell, Bench', 'Dumbbell or Band', 'Dumbbells or Bodyweight'],
    full:          ['Bodyweight', 'Band', 'Dumbbells', 'Dumbbell', 'Dumbbells, Bench', 'Dumbbell, Bench', 'Barbell', 'Cable', 'Dumbbell or Band', 'Dumbbells or Bodyweight', 'Foam Roller', 'Doorframe', 'Wall']
  };


  // ── SESSION NAME MATRIX ──
  // track × session type × phase — picked randomly for personality
  const SESSION_NAMES = {
    foundation: {
      A: [
        "First Things First",
        "The Foundation Holds",
        "Build Before You Break",
        "Earn the Right to Train",
        "Roots Before Branches",
        "The Work Nobody Sees",
      ],
      B: [
        "Balance the Load",
        "The Other Side",
        "Legs Don't Lie",
        "Rotation Starts Here",
        "The Engine Has Two Sides",
        "Unilateral Truth",
      ],
      C: [
        "Dead Stop. Full Send.",
        "From Nothing, Something",
        "Off the Floor",
        "Force Meets Ground",
        "No Momentum. Just Strength.",
        "The Hard Reset",
      ],
      cardio: [
        "Earn the Engine",
        "Slow Is Smooth",
        "The Long Game",
        "This Is the Work",
        "Nose Only",
        "Conversations at Pace",
        "Zone 2 or Zone Out",
      ],
      mobility: [
        "Stay in the Fight",
        "The Quiet Work",
        "Range Is Power",
        "Maintenance Day",
        "The Work Between the Work",
        "Open Everything",
        "Longevity Over Ego",
      ],
    },
    transition: {
      A: [
        "Load the Weapon",
        "Gaps Are Getting Closed",
        "The Middle Ground",
        "Heavy Enough",
        "Progress Has a Weight",
        "Earned Load",
      ],
      B: [
        "One Side at a Time",
        "The Imbalance Ends Here",
        "Rotate or Stagnate",
        "Unilateral and Unbothered",
        "The Weak Side Gets Fixed",
        "Close the Gap",
      ],
      C: [
        "Power Has a Price",
        "Explosive. Then Rest.",
        "Stop. Generate. Go.",
        "The Transition Is Working",
        "Almost Ready",
        "Finish Strong",
      ],
      cardio: [
        "The Engine Responds",
        "Push the Ceiling",
        "Conditioning Is Honest",
        "Your Lungs Know",
        "Two Minutes Tells the Truth",
        "The Work Rate Rises",
      ],
      mobility: [
        "Range Unlocks Power",
        "Shoulders Stay Healthy",
        "Hip Rotation Is the Punch",
        "Keep the Machine Running",
        "Maintenance Wins Fights",
        "The Hinge Needs Oil",
      ],
    },
    fighter: {
      A: [
        "No Shortcuts Left",
        "Sharpen the Weapon",
        "This Is What It Costs",
        "The Hard Sets",
        "Champions Train Like This",
        "Refinement Not Rebuilding",
      ],
      B: [
        "The Fighter's Arsenal",
        "Power Through the Chain",
        "One Side. Full Output.",
        "The Rotation Is Loaded",
        "Weapon Maintenance",
        "Nothing Wasted",
      ],
      C: [
        "Peak Output",
        "The Final Form",
        "Condition or Quit",
        "Five More Rounds",
        "The Finishing Work",
        "This Is the Difference",
      ],
      cardio: [
        "Champions Run Alone",
        "Five More Rounds",
        "The Conditioning Never Lies",
        "Earn the Rounds",
        "Fit to Fight",
        "The Last One Standing",
      ],
      mobility: [
        "Weapons Stay Sharp",
        "The Long Career",
        "Shoulder Check",
        "Hip Health Is Fight Health",
        "Stay Available",
        "The Work That Keeps You Fighting",
      ],
    },
  };

  function getSessionName(track, sessionType, weekNum) {
    const pool = SESSION_NAMES[track]?.[sessionType];
    if (!pool || pool.length === 0) return null;
    // Seed with week number for consistency within a week
    // but variety across weeks
    const idx = (weekNum * 7 + sessionType.length) % pool.length;
    return pool[idx];
  }

  // ── EXERCISE LIBRARY ──
  // Condensed from fitme-exercise-library.xlsx
  // Fields: name, pattern, equipment, minTrack, complexity, bilateral, ballistic, repRange, setRange, tempo, regression, progression, combatValue
  const LIBRARY = [
    // ── PUSH ──
    { name:'DB Bench Press',        pattern:'push',   equipment:['Dumbbells','Bench'],     minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'8–12', sets:'3–4', tempo:'3-1-1', regression:'Push-Up',              progression:'DB Bench + Band',         combatValue:'Pressing foundation, guard maintenance' },
    { name:'DB Floor Press',        pattern:'push',   equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'8–12', sets:'3',   tempo:'Dead stop', regression:'Push-Up',           progression:'DB Bench Press',          combatValue:'Dead stop — rate of force development' },
    { name:'Single-Arm DB Press',   pattern:'push',   equipment:['Dumbbells','Bench'],     minTrack:0, complexity:2, bilateral:false, ballistic:false, repRange:'8–10/side', sets:'3', tempo:'Controlled', regression:'DB Bench',   progression:'SA Press + Rotation',     combatValue:'Anti-rotation demand — punch recovery' },
    { name:'Push-Up',               pattern:'push',   equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'8–20', sets:'3',   tempo:'Full range', regression:'Incline Push-Up', progression:'Hand-Release Push-Up',  combatValue:'Foundational — scales infinitely' },
    { name:'Incline Push-Up',       pattern:'push',   equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'10–15', sets:'3',  tempo:'Controlled', regression:null,              progression:'Push-Up',               combatValue:'Beginner push foundation' },
    { name:'Hand-Release Push-Up',  pattern:'push',   equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:true,  ballistic:true,  repRange:'6–10', sets:'4',   tempo:'Explosive up', regression:'Push-Up',      progression:'Plyometric Push-Up',    combatValue:'Dead stop + explosive — punch power' },
    { name:'DB Overhead Press',     pattern:'push',   equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'8–12', sets:'3',   tempo:'2-1-1', regression:'Seated DB Press',       progression:'Single-Arm DB Press',   combatValue:'Shoulder endurance for sustained guard' },
    { name:'Band Chest Press',      pattern:'push',   equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'2–3', tempo:'Variable', regression:'Push-Up',          progression:'DB Bench + Band',       combatValue:'Variable resistance — power expression' },
    { name:'Pike Push-Up',          pattern:'push',   equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'8–12', sets:'3',   tempo:'Controlled', regression:'Push-Up',         progression:'DB Overhead Press',     combatValue:'Shoulder pressing without equipment' },
    { name:'Incline DB Press',      pattern:'push',   equipment:['Dumbbells','Bench'],     minTrack:1, complexity:1, bilateral:true,  ballistic:false, repRange:'8–12', sets:'3',   tempo:'2-1-1', regression:'Flat DB Bench',         progression:'Single-Arm Incline',    combatValue:'Upper chest — uppercut mechanics' },
    { name:'DB Bench + Band',       pattern:'push',   equipment:['Dumbbells','Band','Bench'], minTrack:1, complexity:2, bilateral:true, ballistic:false, repRange:'8', sets:'4',   tempo:'Explosive', regression:'DB Bench Press',      progression:'Heavier + Band',        combatValue:'Variable resistance — peak power output' },

    // ── PULL ──
    { name:'DB Bent Row',           pattern:'pull',   equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'8–12', sets:'3–4', tempo:'2-1-1', regression:'Band Row',            progression:'Single-Arm DB Row',     combatValue:'Back strength — clinch, punch retraction' },
    { name:'Single-Arm DB Row',     pattern:'pull',   equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'8–10/side', sets:'3–4', tempo:'2-1-1', regression:'Band Row', progression:'Dead Stop SA Row',      combatValue:'Unilateral — punch retraction speed' },
    { name:'Band Pull-Apart',       pattern:'pull',   equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'15–20', sets:'2–3', tempo:'Controlled', regression:'Lighter band', progression:'Band Pull-Apart + Rotation', combatValue:'Shoulder health — sustained guard' },
    { name:'Band Face Pull',        pattern:'pull',   equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'15–20', sets:'3',   tempo:'Slow', regression:'Band Pull-Apart',       progression:'Cable Face Pull',       combatValue:'Rotator cuff — shoulder longevity' },
    { name:'Band Pull-Down',        pattern:'pull',   equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'2–3', tempo:'Full range', regression:'Band Row',       progression:'Weighted Pull-Up',      combatValue:'Lat engagement without overhead equipment' },
    { name:'Band Row',              pattern:'pull',   equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'3',   tempo:'2-1-1', regression:null,                  progression:'DB Bent Row',           combatValue:'Pull foundation — bodyweight/band option' },
    { name:'Inverted Row',          pattern:'pull',   equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'8–12', sets:'3',    tempo:'2-1-1', regression:'Band Row',            progression:'Weighted Inverted Row', combatValue:'Bodyweight pull — scalable to any level' },
    { name:'Band Rear Delt Fly',    pattern:'pull',   equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'15–20', sets:'2',   tempo:'Slow eccentric', regression:'Pull-Apart', progression:'DB Rear Delt Fly',   combatValue:'Rear shoulder — punch recovery, guard' },
    { name:'Door Frame Row',        pattern:'pull',   equipment:['Bodyweight','Doorframe'], minTrack:0, complexity:1, bilateral:true, ballistic:false, repRange:'10–15', sets:'3',   tempo:'2-1-1', regression:null,                  progression:'Inverted Row',          combatValue:'Bodyweight pull with no equipment' },

    // ── SQUAT ──
    { name:'Goblet Squat',          pattern:'squat',  equipment:['Dumbbell'],              minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'10–15', sets:'3–4', tempo:'3-1-1', regression:'Bodyweight Squat',   progression:'DB Front Squat',        combatValue:'Most legible squat — stance power' },
    { name:'Bodyweight Squat',      pattern:'squat',  equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'15–20', sets:'3',   tempo:'3-1-1', regression:null,                 progression:'Goblet Squat',          combatValue:'Foundation squat pattern' },
    { name:'Split Squat',           pattern:'squat',  equipment:['Bodyweight'],            minTrack:0, complexity:2, bilateral:false, ballistic:false, repRange:'8–10/side', sets:'3', tempo:'3-1-1', regression:'Bodyweight Squat', progression:'Bulgarian Split Squat', combatValue:'Unilateral — stance stability' },
    { name:'Bulgarian Split Squat', pattern:'squat',  equipment:['Dumbbells','Bench'],     minTrack:1, complexity:2, bilateral:false, ballistic:false, repRange:'6–10/side', sets:'3–4', tempo:'3-1-1', regression:'Split Squat', progression:'Bulgarian + DB overhead', combatValue:'Most demanding unilateral — fight stance' },
    { name:'DB Squat',              pattern:'squat',  equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'10–12', sets:'3',   tempo:'2-1-1', regression:'Bodyweight Squat',   progression:'DB Front Squat',        combatValue:'Simple bilateral squat' },
    { name:'Lateral Squat',         pattern:'squat',  equipment:['Bodyweight'],            minTrack:1, complexity:2, bilateral:false, ballistic:false, repRange:'8/side', sets:'3',  tempo:'Controlled', regression:'Lateral Lunge',   progression:'Weighted Lateral Squat', combatValue:'Lateral plane — boxing footwork' },
    { name:'Jump Squat',            pattern:'squat',  equipment:['Bodyweight'],            minTrack:1, complexity:2, bilateral:true,  ballistic:true,  repRange:'6–8', sets:'3',     tempo:'Explosive', regression:'Bodyweight Squat',  progression:'Weighted Jump Squat',   combatValue:'Power expression — explosive leg drive' },

    // ── HINGE ──
    { name:'DB Romanian Deadlift',  pattern:'hinge',  equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'10–12', sets:'3–4', tempo:'3-1-1', regression:'Hip Hinge',          progression:'DB RDL + Band',         combatValue:'Posterior chain — hip power for all punches' },
    { name:'DB Deadlift from Floor',pattern:'hinge',  equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'6–10', sets:'3–4',  tempo:'Dead stop', regression:'DB RDL',           progression:'Heavy DB Deadlift',     combatValue:'Dead stop — force from static position' },
    { name:'Single-Leg RDL',        pattern:'hinge',  equipment:['Dumbbell'],              minTrack:0, complexity:2, bilateral:false, ballistic:false, repRange:'8–10/side', sets:'3', tempo:'Slow', regression:'DB RDL',            progression:'SL RDL + KB',           combatValue:'Balance + posterior chain — stance stability' },
    { name:'DB Swing',              pattern:'hinge',  equipment:['Dumbbell'],              minTrack:0, complexity:2, bilateral:true,  ballistic:true,  repRange:'10–15', sets:'3–4', tempo:'Explosive hip snap', regression:'Hip Hinge', progression:'Single-Arm DB Swing',  combatValue:'Explosive hip extension — engine of every cross' },
    { name:'Hip Thrust',            pattern:'hinge',  equipment:['Dumbbell','Bench'],      minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'3',   tempo:'Hold 1 sec top', regression:'Glute Bridge', progression:'Banded Hip Thrust',   combatValue:'Glute strength — power transfer in punching' },
    { name:'Glute Bridge',          pattern:'hinge',  equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'15–20', sets:'2–3', tempo:'Hold 2 sec top', regression:null,          progression:'Hip Thrust',            combatValue:'Glute activation — foundational hip extension' },
    { name:'Good Morning',          pattern:'hinge',  equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'2–3', tempo:'Hinge not squat', regression:'Hip Hinge',  progression:'DB Good Morning',       combatValue:'Posterior chain and lower back — injury prevention' },
    { name:'Single-Arm DB Swing',   pattern:'hinge',  equipment:['Dumbbell'],              minTrack:1, complexity:2, bilateral:false, ballistic:true,  repRange:'8–10/side', sets:'3', tempo:'Explosive', regression:'DB Swing',       progression:'KB Single-Arm Swing',   combatValue:'Unilateral explosive hip — rotational power' },
    { name:'Hip Hinge',             pattern:'hinge',  equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'15', sets:'2',       tempo:'Slow', regression:null,                  progression:'Glute Bridge',          combatValue:'Pattern teaching — fundamental movement' },
    { name:'Band Pull-Through',     pattern:'hinge',  equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'3',   tempo:'Hip drive', regression:'Glute Bridge',      progression:'DB Swing',              combatValue:'Hip extension pattern with band — safe regression' },

    // ── CARRY ──
    { name:'Farmer Carry',          pattern:'carry',  equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'20–40 sec', sets:'3–4', tempo:'Walk slow', regression:'Lighter weight', progression:'Single-Arm Carry',   combatValue:'Structural integrity — clinch, grip, sustained guard' },
    { name:'Single-Arm Farmer Carry',pattern:'carry', equipment:['Dumbbell'],              minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'20–40 sec/side', sets:'3–4', tempo:'Anti-lateral-flexion', regression:'Farmer Carry', progression:'Suitcase + Overhead', combatValue:'Anti-lateral flexion — punch mechanics' },
    { name:'Suitcase Carry',        pattern:'carry',  equipment:['Dumbbell'],              minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'20–40 sec/side', sets:'3',   tempo:'Resist side bend', regression:'Farmer Carry',   progression:'Overhead Carry',       combatValue:'Lateral core stability — resisting force' },
    { name:'Overhead Carry',        pattern:'carry',  equipment:['Dumbbell'],              minTrack:1, complexity:2, bilateral:false, ballistic:false, repRange:'20–30 sec/side', sets:'3',   tempo:'Locked elbow', regression:'Farmer Carry',       progression:'Bottoms-Up Carry',     combatValue:'Shoulder stability — sustaining guard position' },
    { name:'Marching Lunge',        pattern:'carry',  equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'10/side', sets:'3',  tempo:'Controlled step', regression:null,                progression:'Weighted Marching Lunge', combatValue:'Bodyweight carry substitute — core + legs' },
    { name:'Bear Crawl',            pattern:'carry',  equipment:['Bodyweight'],            minTrack:0, complexity:2, bilateral:true,  ballistic:false, repRange:'20–30 sec', sets:'3', tempo:'Slow and controlled', regression:'Plank',          progression:'Loaded Bear Crawl',    combatValue:'Full body tension — core, shoulders, hips' },

    // ── ROTATE ──
    { name:'Pallof Press',          pattern:'rotate', equipment:['Band'],                  minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'10–12/side', sets:'3', tempo:'Slow press and return', regression:'Pallof Hold', progression:'Pallof Press + Step', combatValue:'Anti-rotation foundation — punch power transfer' },
    { name:'Band Woodchop High-Low',pattern:'rotate', equipment:['Band'],                  minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'10–12/side', sets:'3', tempo:'Controlled arc', regression:'Half-Kneeling Woodchop', progression:'Weighted Woodchop', combatValue:'Diagonal power — mirrors cross/hook kinetic chain' },
    { name:'Band Woodchop Low-High',pattern:'rotate', equipment:['Band'],                  minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'10–12/side', sets:'3', tempo:'Drive from hips', regression:'Half-Kneeling variation', progression:'Loaded Low-High', combatValue:'Uppercut power — hip-to-shoulder from below' },
    { name:'Anti-Rotation Hold',    pattern:'rotate', equipment:['Band'],                  minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'20–30 sec/side', sets:'2', tempo:'Isometric', regression:'Lighter band',        progression:'Pallof Press',         combatValue:'Pure anti-rotation — makes rotation powerful' },
    { name:'Band Rotational Press', pattern:'rotate', equipment:['Band'],                  minTrack:1, complexity:2, bilateral:false, ballistic:false, repRange:'10/side', sets:'3',  tempo:'Rotate then press', regression:'Pallof Press',       progression:'Rotational Press + Step', combatValue:'Combines rotation + press — full punch mechanics' },
    { name:'Dead Bug',              pattern:'rotate', equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'8/side', sets:'3',   tempo:'Slow, breathe out', regression:null,                  progression:'Dead Bug + Band',      combatValue:'Anti-rotation core — bodyweight option' },
    { name:'Bird Dog',              pattern:'rotate', equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'10/side', sets:'3',  tempo:'Slow and controlled', regression:null,                progression:'Dead Bug',             combatValue:'Spinal stability + anti-rotation — no equipment' },
    { name:'Half-Kneeling Woodchop',pattern:'rotate', equipment:['Band'],                  minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'10–12/side', sets:'2', tempo:'Hip-driven', regression:'Standing Woodchop',      progression:'Full Woodchop',        combatValue:'Isolates core rotation — removes leg drive' },

    // ── ISOLATION ──
    { name:'DB Curl',               pattern:'pull',   equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'10–15', sets:'2–3', tempo:'Full range', regression:'Band Curl',           progression:'Hammer Curl',           combatValue:'Bicep/forearm endurance — sustained guard, hook' },
    { name:'Hammer Curl',           pattern:'pull',   equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'10–15', sets:'2–3', tempo:'Neutral grip', regression:'DB Curl',             progression:'Single-Arm Hammer Curl', combatValue:'Brachialis — wrist stability when punching' },
    { name:'Band Curl',             pattern:'pull',   equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'2',   tempo:'Full range', regression:null,                  progression:'DB Curl',               combatValue:'Bicep endurance — band option' },
    { name:'Tricep Kickback',       pattern:'push',   equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'2–3', tempo:'Full extension', regression:'Band Tricep',         progression:'Single-Arm Kickback',   combatValue:'Tricep endurance — sustained punching output' },
    { name:'Band Tricep Pushdown',  pattern:'push',   equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'15–20', sets:'2',   tempo:'Full extension', regression:null,                  progression:'Weighted Pushdown',     combatValue:'High-rep tricep endurance — punch extension speed' },
    { name:'Tricep Dip',            pattern:'push',   equipment:['Bodyweight'],            minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'8–15', sets:'3',    tempo:'Controlled', regression:'Bench Dip',              progression:'Weighted Dip',          combatValue:'Tricep strength — bodyweight option' },
    { name:'Lateral Raise',         pattern:'push',   equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'2',   tempo:'Controlled arc', regression:'Band Lateral Raise',  progression:'Single-Arm Lateral Raise', combatValue:'Medial deltoid — lateral guard endurance' },
    { name:'DB Shrug',              pattern:'pull',   equipment:['Dumbbells'],             minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'2–3', tempo:'Hold 1 sec', regression:'Band Shrug',            progression:'Shrug Carry',           combatValue:'Trap/neck strength — taking punches, clinch' },
    { name:'DB Lateral Lunge',      pattern:'squat',  equipment:['Dumbbell'],              minTrack:0, complexity:1, bilateral:false, ballistic:false, repRange:'8–10/side', sets:'3', tempo:'Push hips back', regression:'Bodyweight Lateral Lunge', progression:'Weighted Lateral Squat', combatValue:'Lateral plane — footwork, pivoting' },
    { name:'Band Leg Curl',         pattern:'hinge',  equipment:['Band'],                  minTrack:0, complexity:1, bilateral:true,  ballistic:false, repRange:'12–15', sets:'2',   tempo:'Full range', regression:null,                  progression:'Single-Leg Band Curl',  combatValue:'Hamstring isolation — posterior knee stability' },
  ];

  // ── TRACK LEVELS ──
  const TRACK_LEVEL = { foundation: 0, transition: 1, fighter: 2 };

  // ── ISOLATION EXERCISE MAP ──
  // Keyed by muscle group, filtered by equipment
  const ISOLATION_MAP = {
    bicep: [
      { name: 'DB Curl',        equipment: ['Dumbbells'], repRange: '10–15', sets: '2', tempo: 'Full range, squeeze at top', combatValue: 'Bicep endurance — sustained guard and hook power' },
      { name: 'Hammer Curl',    equipment: ['Dumbbells'], repRange: '10–15', sets: '2', tempo: 'Neutral grip, controlled',   combatValue: 'Brachialis — wrist stability when punching' },
      { name: 'Band Curl',      equipment: ['Band'],      repRange: '12–15', sets: '2', tempo: 'Full range',                 combatValue: 'Bicep endurance — band option' },
    ],
    tricep: [
      { name: 'Tricep Kickback',     equipment: ['Dumbbells'], repRange: '12–15', sets: '2', tempo: 'Full extension',         combatValue: 'Tricep endurance — sustained punching output' },
      { name: 'Band Tricep Pushdown',equipment: ['Band'],      repRange: '15–20', sets: '2', tempo: 'Full extension',         combatValue: 'High-rep tricep endurance — punch extension speed' },
      { name: 'Tricep Dip',          equipment: ['Bodyweight'],repRange: '8–15',  sets: '2', tempo: 'Controlled',             combatValue: 'Tricep strength — bodyweight option' },
    ],
    shoulder: [
      { name: 'Lateral Raise',   equipment: ['Dumbbells'], repRange: '12–15', sets: '2', tempo: 'Controlled arc',    combatValue: 'Medial deltoid — lateral guard endurance' },
      { name: 'DB Shrug',        equipment: ['Dumbbells'], repRange: '12–15', sets: '2', tempo: 'Hold 1 sec at top', combatValue: 'Trap and neck — taking punches, clinch' },
    ],
    hamstring: [
      { name: 'Band Leg Curl',   equipment: ['Band'],      repRange: '12–15', sets: '2', tempo: 'Full range',        combatValue: 'Hamstring isolation — posterior knee stability' },
      { name: 'Glute Bridge',    equipment: ['Bodyweight'],repRange: '15–20', sets: '2', tempo: 'Hold 2 sec top',    combatValue: 'Glute activation — foundational hip extension' },
    ],
  };

  function pickIsolation(muscleGroup, equipmentTier) {
    const allowed = EQUIPMENT[equipmentTier] || EQUIPMENT.dumbbells;
    const pool = (ISOLATION_MAP[muscleGroup] || []).filter(ex =>
      ex.equipment.some(e => allowed.some(a => a.toLowerCase() === e.toLowerCase()))
    );
    if (pool.length === 0) return null;
    return { ...pool[0], pattern: 'pull', role: 'Isolation', adjusted: false };
  }

  // ── EQUIPMENT FILTER ──
  function equipmentAllowed(exercise, tier) {
    const allowed = EQUIPMENT[tier] || EQUIPMENT.dumbbells;
    return exercise.equipment.every(e => allowed.some(a => a.toLowerCase() === e.toLowerCase()));
  }

  // ── TRACK FILTER ──
  function trackAllowed(exercise, track) {
    return exercise.minTrack <= TRACK_LEVEL[track];
  }

  // ── FILTER LIBRARY ──
  function filterLibrary(track, equipmentTier) {
    return LIBRARY.filter(ex =>
      trackAllowed(ex, track) &&
      equipmentAllowed(ex, equipmentTier)
    );
  }

  // ── PATTERN PICKER ──
  // Returns exercises for a pattern, sorted by complexity (prefer simpler at Foundation)
  function pickForPattern(pattern, track, equipmentTier, bilateral = null, ballistic = null, count = 1) {
    let pool = filterLibrary(track, equipmentTier)
      .filter(ex => ex.pattern === pattern);

    if (bilateral !== null) pool = pool.filter(ex => ex.bilateral === bilateral);
    if (ballistic !== null) pool = pool.filter(ex => ex.ballistic === ballistic);

    // Sort: prefer lower complexity at Foundation, higher at Fighter
    const level = TRACK_LEVEL[track];
    pool.sort((a, b) => level === 0 ? a.complexity - b.complexity : b.complexity - a.complexity);

    return pool.slice(0, count);
  }

  // ── DYNAMIC ADJUSTMENTS ──
  // Apply lever adjustments based on session log signals
  function applyAdjustments(exercise, sessionLogs, pattern) {
    const patternLogs = (sessionLogs || [])
      .filter(log => log.pattern === pattern)
      .slice(-6); // last 6 sessions of this pattern

    if (patternLogs.length < 3) return exercise; // not enough data

    const avgFeel = patternLogs.reduce((a, b) => a + b.feel, 0) / patternLogs.length;

    let adjusted = { ...exercise, adjusted: false, adjustmentNote: null };

    if (avgFeel < 1.5) {
      // Too hard — apply regression lever
      if (exercise.regression) {
        const regression = LIBRARY.find(e => e.name === exercise.regression);
        if (regression) {
          adjusted = { ...regression, adjusted: true, adjustmentNote: `Adjusted from ${exercise.name} — building up` };
        }
      }
    } else if (avgFeel > 2.5) {
      // Too easy — apply progression levers
      // Lever 1: bump rep range first
      const [low, high] = exercise.repRange.replace('/side','').split('–').map(Number);
      if (!isNaN(low) && !isNaN(high) && high < 20) {
        adjusted.repRange = `${low + 2}–${high + 3}`;
        adjusted.adjusted = true;
        adjusted.adjustmentNote = 'Rep range increased — keep progressing';
      } else if (exercise.progression) {
        // Lever 3: swap to progression exercise
        const progression = LIBRARY.find(e => e.name === exercise.progression);
        if (progression) {
          adjusted = { ...progression, adjusted: true, adjustmentNote: `Progressed from ${exercise.name} — ready for more` };
        }
      }
    }

    return adjusted;
  }

  // ── GENERATE SESSION ──
  // Generates one of three session types
  function generateSession(type, track, equipmentTier, weekNum, sessionLogs) {
    const sessions = {

      // Monday: Push / Pull / Hinge — bilateral primary
      A: () => {
        const phase = weekNum <= 4 ? 1 : weekNum <= 8 ? 2 : 3;
        const push  = pickForPattern('push',  track, equipmentTier, true,  false, 1)[0];
        const pull  = pickForPattern('pull',  track, equipmentTier, true,  false, 1)[0];
        const hinge = pickForPattern('hinge', track, equipmentTier, true,  false, 1)[0];
        const carry = pickForPattern('carry', track, equipmentTier, null,  null,  1)[0];
        const iso1  = pickIsolation('tricep', equipmentTier); // tricep after push day
        const iso2  = pickIsolation('bicep',  equipmentTier); // bicep after pull day

        const nameA = getSessionName(track, 'A', weekNum) || 'Push · Pull · Hinge';
        return {
          name: nameA,
          type: 'strength',
          day: 'Monday',
          phase,
          exercises: [
            push  && { ...applyAdjustments(push,  sessionLogs, 'push'),  role: 'Primary',   sets: phase === 1 ? '3' : phase === 2 ? '4' : '4', tempo: phase === 1 ? '3-1-1' : '2-1-1' },
            pull  && { ...applyAdjustments(pull,  sessionLogs, 'pull'),  role: 'Primary',   sets: phase === 1 ? '3' : '4', tempo: phase === 1 ? '3-1-1' : '2-1-1' },
            hinge && { ...applyAdjustments(hinge, sessionLogs, 'hinge'), role: 'Primary',   sets: phase === 1 ? '3' : '4', tempo: phase === 1 ? '3-1-1' : '2-1-1' },
            carry && { ...carry, role: 'Carry', sets: '3', repRange: '40 sec' },
            iso1  && { ...iso1, role: 'Isolation', sets: '2', repRange: `${iso1.repRange} · to failure` },
            iso2  && { ...iso2, role: 'Isolation', sets: '2', repRange: `${iso2.repRange} · to failure` },
          ].filter(Boolean)
        };
      },

      // Thursday: Squat / Rotate / Unilateral
      B: () => {
        const phase = weekNum <= 4 ? 1 : weekNum <= 8 ? 2 : 3;
        const squat  = pickForPattern('squat',  track, equipmentTier, false, false, 1)[0]; // unilateral
        const push   = pickForPattern('push',   track, equipmentTier, false, false, 1)[0]; // unilateral push
        const pull   = pickForPattern('pull',   track, equipmentTier, false, false, 1)[0]; // unilateral pull
        const rotate = pickForPattern('rotate', track, equipmentTier, false, null,  1)[0];
        const iso1   = pickIsolation('shoulder',  equipmentTier); // shoulder after push/pull unilateral
        const iso2b  = pickIsolation('hamstring', equipmentTier); // hamstring after squat/hinge

        const nameB = getSessionName(track, 'B', weekNum) || 'Squat · Rotate · Unilateral';
        return {
          name: nameB,
          type: 'strength',
          day: 'Thursday',
          phase,
          exercises: [
            squat  && { ...applyAdjustments(squat,  sessionLogs, 'squat'),  role: 'Primary',   sets: phase === 1 ? '3' : '4', tempo: '3-1-1' },
            push   && { ...applyAdjustments(push,   sessionLogs, 'push'),   role: 'Unilateral', sets: '3', tempo: 'Controlled' },
            pull   && { ...applyAdjustments(pull,   sessionLogs, 'pull'),   role: 'Unilateral', sets: '3', tempo: '2-1-1' },
            rotate && { ...applyAdjustments(rotate, sessionLogs, 'rotate'), role: 'Rotation',   sets: '3', tempo: 'Slow' },
            iso1   && { ...iso1,  role: 'Isolation', sets: '2', repRange: `${iso1.repRange} · to failure` },
            iso2b  && { ...iso2b, role: 'Isolation', sets: '2', repRange: `${iso2b.repRange} · to failure` },
          ].filter(Boolean)
        };
      },

      // Saturday: Dead Stops + Power + Conditioning
      C: () => {
        const phase = weekNum <= 4 ? 1 : weekNum <= 8 ? 2 : 3;
        const hinge = pickForPattern('hinge', track, equipmentTier, true, true, 1)[0]  // ballistic hinge
                   || pickForPattern('hinge', track, equipmentTier, true, false, 1)[0]; // fallback
        const push  = pickForPattern('push',  track, equipmentTier, true, true, 1)[0]  // ballistic push
                   || pickForPattern('push',  track, equipmentTier, true, false, 1)[0];
        const pull  = pickForPattern('pull',  track, equipmentTier, true, false, 1)[0];
        const carry = pickForPattern('carry', track, equipmentTier, false, null, 1)[0]; // unilateral carry

        const hiit = phase >= 2 ? {
          name: 'Conditioning Finisher',
          pattern: 'cardio',
          role: 'Finisher',
          sets: phase === 2 ? '4' : '5',
          repRange: phase === 2 ? '30 sec · all-out' : '45 sec · all-out',
          tempo: `${phase === 2 ? '90' : '90'} sec rest between`,
          combatValue: 'Aerobic + anaerobic conditioning',
          adjusted: false
        } : null;

        const nameC = getSessionName(track, 'C', weekNum) || 'Dead Stops · Power · Conditioning';
        return {
          name: nameC,
          type: 'strength-cardio',
          day: 'Saturday',
          phase,
          exercises: [
            hinge && { ...applyAdjustments(hinge, sessionLogs, 'hinge'), role: 'Power Hinge', sets: phase === 1 ? '3' : '4', tempo: 'Dead stop + explosive' },
            push  && { ...applyAdjustments(push,  sessionLogs, 'push'),  role: 'Power Push',  sets: '4', tempo: 'Dead stop + explosive' },
            pull  && { ...applyAdjustments(pull,  sessionLogs, 'pull'),  role: 'Tempo Pull',  sets: '3', tempo: '3-1-1' },
            carry && { ...carry, role: 'Carry', sets: '3', repRange: '40 sec' },
            pickIsolation('bicep',  equipmentTier) && { ...pickIsolation('bicep',  equipmentTier), role: 'Isolation', sets: '2', repRange: `${pickIsolation('bicep', equipmentTier)?.repRange} · to failure` },
            hiit,
          ].filter(Boolean)
        };
      },

      // Tuesday: Cardio
      cardio: () => ({
        name: getSessionName(track, 'cardio', weekNum) || 'Zone 2 · Cardio',
        type: 'cardio',
        day: 'Tuesday',
        phase: weekNum <= 4 ? 1 : weekNum <= 8 ? 2 : 3,
        exercises: [
          { name: 'Warm-up', pattern: 'cardio', role: 'Warm-Up', sets: '1', repRange: '5 min easy walk', tempo: '', combatValue: '', adjusted: false },
          { name: 'Zone 2 · Jump Rope or Footwork', pattern: 'cardio', role: 'Zone 2', sets: weekNum <= 4 ? '2' : '1', repRange: weekNum <= 4 ? '10 min / 2 min rest' : '25–30 min continuous', tempo: 'Nose breathe · conversational pace · under 134 bpm', combatValue: 'Mitochondrial density — aerobic base', adjusted: false },
          { name: 'Shadow Boxing', pattern: 'cardio', role: 'Cool Down', sets: '1', repRange: '5–10 min', tempo: 'Loose · no intensity · just move', combatValue: 'Movement pattern reinforcement', adjusted: false },
        ]
      }),

      // Sunday: Mobility
      mobility: () => ({
        name: getSessionName(track, 'mobility', weekNum) || 'Mobility',
        type: 'mobility',
        day: 'Sunday',
        phase: 1,
        exercises: [
          { name: 'Shoulder Complex', pattern: 'mobility', role: 'Shoulders', sets: '2–3', repRange: '30–45 sec each', tempo: 'Slow and relaxed', combatValue: 'Hook arc + shoulder longevity', adjusted: false },
          { name: 'Hip Mobility', pattern: 'mobility', role: 'Hips', sets: '2', repRange: '45 sec/side', tempo: 'Breathe into range', combatValue: 'Cross rotation + footwork range', adjusted: false },
          { name: 'Thoracic Rotation', pattern: 'mobility', role: 'Thoracic', sets: '2', repRange: '10 reps/side', tempo: 'Breath-driven', combatValue: 'Power transfer — hips to hands', adjusted: false },
          { name: 'Breath Work', pattern: 'mobility', role: 'Close', sets: '1', repRange: '5 min', tempo: '4-7-8 pattern', combatValue: 'Parasympathetic reset — fight recovery', adjusted: false },
        ]
      }),
    };

    return sessions[type] ? sessions[type]() : null;
  }

  // ── GENERATE FULL WEEK ──
  function generateWeek(track, equipmentTier, weekNum, sessionLogs) {
    const week = {
      weekNum,
      track,
      equipmentTier,
      generated: new Date().toISOString(),
      sessions: {
        monday:    generateSession('A',       track, equipmentTier, weekNum, sessionLogs),
        tuesday:   generateSession('cardio',  track, equipmentTier, weekNum, sessionLogs),
        wednesday: null, // rest
        thursday:  generateSession('B',       track, equipmentTier, weekNum, sessionLogs),
        friday:    null, // rest
        saturday:  generateSession('C',       track, equipmentTier, weekNum, sessionLogs),
        sunday:    generateSession('mobility',track, equipmentTier, weekNum, sessionLogs),
      }
    };

    // Check for adjustments
    const adjusted = Object.values(week.sessions)
      .filter(Boolean)
      .flatMap(s => s.exercises || [])
      .filter(e => e && e.adjusted);

    week.hasAdjustments = adjusted.length > 0;
    week.adjustmentCount = adjusted.length;

    return week;
  }

  // ── BODYWEIGHT CARRY NOTE ──
  function getCarryNote(equipmentTier) {
    if (equipmentTier === 'bodyweight') {
      return 'Carry pattern is limited with bodyweight only. Marching lunges and bear crawls are substituted — they build similar structural integrity but with less loading. Consider adding bands or light dumbbells when possible.';
    }
    return null;
  }

  // ── PUBLIC API ──
  return {
    generateWeek,
    generateSession,
    filterLibrary,
    getCarryNote,
    getSessionName,
    LIBRARY,
    EQUIPMENT,
  };

})();

// Export for use in other files
if (typeof module !== 'undefined') module.exports = PROGRAM_GENERATOR;
