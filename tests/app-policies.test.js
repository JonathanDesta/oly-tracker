'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PROGRAM } = require('../js/program.js');
global.PROGRAM = PROGRAM;
const storage = new Map();
Object.defineProperty(global, 'localStorage', { value: {
  setItem: (k, v) => storage.set(k, String(v)),
  getItem: k => storage.get(k) || null,
  removeItem: k => storage.delete(k),
}, configurable: true });
const app = require('../js/app.js');
const { STATE } = app;

function reset() {
  storage.clear();
  STATE.maxes = { snatch:155, cj:205, jerk:205, clean:255, bs:365, fs:275, bench:265 };
  STATE.program = { blockId:1, weekInBlock:0 };
  STATE.cycleId = 1;
  STATE.readiness = 'green';
  STATE.readinessDate = null;
  STATE.pickupDays = [];
  STATE.pickupTiming = {};
  STATE.pickupWeekKey = null;
  STATE.receiving = { hh_clean:165, recv_clean:190 };
  STATE.receivingMeta = { hh_clean:{stalls:0}, recv_clean:{stalls:0} };
  STATE.technicalProgress = { hhSnatchPct:65, lastExposureKey:null };
  STATE.copenhagen = { step:1, load:0, lastExposureKey:null };
  STATE.tmWatch = {};
  STATE.log = {};
  STATE.hypertrophyWeights = {};
  STATE.activeWorkout = null;
}

test.beforeEach(reset);

test('slot-specific double progression requires the rep ceiling and target RIR', () => {
  STATE.activeWorkout = { dayKey:'monday' };
  const monday = { id:'incline_db_press', slotKey:'mon_incline', sets:3, repRange:[6,8], rirNote:'~3 RIR' };
  const wednesday = { ...monday, slotKey:'wed_incline' };
  for (let i = 0; i < 3; i++) app.recordHypertrophySet(monday, 60, 8, monday.repRange, 3, 3);
  for (let i = 0; i < 3; i++) app.recordHypertrophySet(wednesday, 65, 8, wednesday.repRange, 3, i === 2 ? '' : 3);
  app.finalizeHypertrophyProgression();
  assert.equal(STATE.hypertrophyWeights.mon_incline.progressNext, true);
  assert.equal(STATE.hypertrophyWeights.wed_incline.progressNext, false);
});

test('bounded TM exception needs three complete A-grade exposures and fires once', () => {
  const day = { sections:[{ exercises:[{ id:'snatch_floor', sets:1, reps:1, pct:85, baseLift:'snatch' }] }] };
  for (const week of [9,10,11]) {
    STATE.activeWorkout = {
      blockId:5, programWeek:week,
      setsLogged:{ '0_snatch_floor':[{ outcome:'make', grade:'A', rpe:7, actualPct:85 }] },
    };
    app.settleTmException(day);
  }
  assert.equal(STATE.maxes.snatch, 160);
  assert.equal(STATE.tmWatch.snatch.bumped, true);
  STATE.activeWorkout = { blockId:5, programWeek:12, setsLogged:{ '0_snatch_floor':[{ outcome:'make', grade:'A', rpe:6, actualPct:90 }] } };
  app.settleTmException(day);
  assert.equal(STATE.maxes.snatch, 160);
});

test('a partial or B-grade eligible exposure resets the TM streak', () => {
  const day = { sections:[{ exercises:[{ id:'jerk_rack_heavy', sets:2, reps:1, pct:85, baseLift:'jerk' }] }] };
  STATE.tmWatch.jerk = { streak:2, bumped:false, lastExposureKey:null };
  STATE.activeWorkout = { blockId:5, programWeek:10, setsLogged:{ '0_jerk_rack_heavy':[{ outcome:'make', grade:'A', rpe:7, actualPct:85 }] } };
  app.settleTmException(day);
  assert.equal(STATE.tmWatch.jerk.streak, 0);
  STATE.activeWorkout = { blockId:5, programWeek:11, setsLogged:{ '0_jerk_rack_heavy':[
    { outcome:'make', grade:'A', rpe:7, actualPct:85 }, { outcome:'make', grade:'B', rpe:7, actualPct:85 },
  ] } };
  app.settleTmException(day);
  assert.equal(STATE.tmWatch.jerk.streak, 0);
});

test('receiving gates use fixed 8/3-rep standards and are idempotent per week', () => {
  const wed = { sections:[{ exercises:[{ id:'hh_clean', recvKey:'hh_clean', sets:4, reps:2 }] }] };
  const cleanSets = Array.from({length:4}, () => ({ weight:165, reps:2, lowReps:2, highReps:0, stood:true }));
  STATE.activeWorkout = { blockId:1, programWeek:1, setsLogged:{ '0_hh_clean':cleanSets } };
  app.settleReceiving(wed);
  assert.equal(STATE.receiving.hh_clean, 170);
  app.settleReceiving(wed);
  assert.equal(STATE.receiving.hh_clean, 170);

  STATE.activeWorkout = { blockId:1, programWeek:2, setsLogged:{ '0_hh_clean':cleanSets.slice(0,3) } };
  app.settleReceiving(wed);
  assert.equal(STATE.receiving.hh_clean, 170);
  assert.equal(STATE.receivingMeta.hh_clean.stalls, 0);

  const fri = { sections:[{ exercises:[{ id:'recv_clean', recvKey:'recv_clean', sets:3, reps:1 }] }] };
  STATE.activeWorkout = { blockId:1, programWeek:1, setsLogged:{ '0_recv_clean':[
    {weight:190,reps:1,lowReps:1,highReps:0,stood:true}, {weight:190,reps:1,lowReps:1,highReps:0,stood:true}, {weight:190,reps:1,lowReps:1,highReps:0,stood:true},
  ] } };
  app.settleReceiving(fri);
  assert.equal(STATE.receiving.recv_clean, 195);

  STATE.activeWorkout = { cycleId:1, blockId:1, programWeek:2, setsLogged:{ '0_recv_clean':[
    {weight:185,reps:1,lowReps:1,highReps:0,stood:true}, {weight:185,reps:1,lowReps:1,highReps:0,stood:true}, {weight:185,reps:1,lowReps:1,highReps:0,stood:true},
  ] } };
  app.settleReceiving(fri);
  assert.equal(STATE.receiving.recv_clean, 195);
  assert.equal(STATE.receivingMeta.recv_clean.stalls, 0);

  STATE.activeWorkout = { cycleId:1, blockId:1, programWeek:3, setsLogged:{ '0_recv_clean':[
    {weight:195,reps:1,lowReps:0,highReps:1,stood:true},
    {weight:185,reps:1,lowReps:1,highReps:0,stood:true,retryOverride:true},
    {weight:195,reps:1,lowReps:1,highReps:0,stood:true},
  ] } };
  app.settleReceiving(fri);
  assert.equal(STATE.receiving.recv_clean, 195);
  assert.equal(STATE.receivingMeta.recv_clean.stalls, 1);
});

test('high-hang snatch and Copenhagen progress only through their quality gates', () => {
  const hh = { sections:[{ exercises:[{ id:'hh_snatch', qualityCeiling:true, sets:4, reps:2, pct:65, baseLift:'snatch' }] }] };
  STATE.activeWorkout = { cycleId:1, blockId:5, readiness:'green', programWeek:9, setsLogged:{ '0_hh_snatch':Array.from({length:4}, () => ({weight:100,reps:2,lowReps:2,highReps:0,stood:true})) } };
  app.settleHighHangSnatch(hh);
  assert.equal(STATE.technicalProgress.hhSnatchPct, 67.5);

  const cph = { sections:[{ exercises:[{ id:'copenhagen', sets:2, timedSets:true }] }] };
  STATE.activeWorkout = { blockId:1, programWeek:1, setsLogged:{ '0_copenhagen':[{seconds:20},{seconds:20}] } };
  app.settleCopenhagen(cph);
  assert.equal(STATE.copenhagen.step, 2);
});

test('miss-stop policy distinguishes true misses from C-grade makes', () => {
  assert.match(app.exerciseStopReason([{outcome:'miss'},{outcome:'miss'}]), /Two misses/);
  assert.match(app.exerciseStopReason([{outcome:'make',grade:'C'},{outcome:'make',grade:'C'}]), /poor successes/);
  assert.equal(app.exerciseStopReason([{outcome:'make',grade:'C'},{outcome:'make',grade:'B'}]), '');
});

test('competition doubles are logged and counted as individual attempts', () => {
  const ex = {id:'snatch_floor',sets:5,reps:2};
  const first = {...app.nextQualityAttempt(ex,[]),outcome:'make',grade:'A'};
  assert.deepEqual(first,{setNumber:1,repNumber:1,outcome:'make',grade:'A'});
  const secondPos = app.nextQualityAttempt(ex,[first]);
  assert.deepEqual(secondPos,{setNumber:1,repNumber:2});
  const second = {...secondPos,outcome:'make',grade:'B'};
  assert.equal(app.completedQualitySets(ex,[first,second]),1);
  const miss = {...app.nextQualityAttempt(ex,[first,second]),outcome:'miss',grade:'C'};
  assert.deepEqual([miss.setNumber,miss.repNumber],[2,1]);
  assert.equal(app.completedQualitySets(ex,[first,second,miss]),2);
  assert.deepEqual(app.nextQualityAttempt(ex,[first,second,miss]),{setNumber:3,repNumber:1});
});

test('quality analytics keeps C-grade makes separate from actual misses', () => {
  const base = { liftKey:'snatch', actualPct:85, cycleId:1, blockId:5, ts:Date.now() };
  STATE.log = { a:{ setsLogged:{ x:[
    {...base,grade:'A',outcome:'make'},
    {...base,grade:'C',outcome:'make'},
    {...base,grade:'C',outcome:'miss',missDirection:'forward'},
  ] } } };
  const [g] = app.qualityAnalytics();
  assert.equal(g.attempts, 3);
  assert.equal(g.aRate, 33);
  assert.equal(g.missRate, 33);
  assert.equal(g.c, 2);
  assert.equal(g.misses, 1);
});

test('receiving override remains session-only and respects the slot', () => {
  STATE.activeWorkout = { receivingOverrides:{}, loadOverrides:{hh_snatch:100} };
  assert.equal(app.prescribedWeight({ id:'hh_snatch', baseLift:'snatch', pct:70 }), 100);
  assert.equal(STATE.maxes.snatch, 155);
});

test('active-session TM snapshots and final miss overrides prevent load drift', () => {
  STATE.activeWorkout = {
    tmSnapshot:{snatch:150,cj:200,jerk:200,clean:250,bs:350,fs:270,bench:260},
    receivingOverrides:{hh_clean:147.5}, loadOverrides:{},
  };
  STATE.maxes.snatch = 200;
  assert.equal(app.prescribedWeight({id:'snatch_floor',baseLift:'snatch',pct:70}), 105);
  assert.equal(app.prescribedWeight({id:'hh_clean',recvKey:'hh_clean',loadMultiplier:0.95}), 147.5);
});

test('test results are atomic and must all belong to the current cycle', () => {
  for (const lift of Object.keys(PROGRAM.liftNames)) {
    STATE.testResults = STATE.testResults || {};
    STATE.testResults[lift] = {estimated1rm:200,sourceCycleId:1,attemptVerified:true};
  }
  assert.equal(app.testResultsReady(), true);
  STATE.testResults.bench.sourceCycleId = 2;
  assert.equal(app.testResultsReady(), false);
});

test('heavy-double test results require a matching made double at the same RPE', () => {
  const attempts = [
    {weight:315,reps:1,rpe:8,outcome:'make'},
    {weight:315,reps:2,rpe:9,outcome:'make'},
    {weight:320,reps:2,rpe:8,outcome:'miss'},
  ];
  assert.equal(app.hasMatchingTestAttempt(attempts,315,2,8),false);
  assert.equal(app.hasMatchingTestAttempt(attempts,315,2,9),true);
  assert.equal(app.hasMatchingTestAttempt(attempts,320,2,8),false);
});

test('readiness is daily and pickup context is program-week scoped', () => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const todayKey = PROGRAM.dayKeys[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const otherKey = PROGRAM.dayKeys.find(d => d !== todayKey);
  STATE.readiness = 'red';
  STATE.readinessDate = date;
  assert.equal(app.programContext(todayKey).readiness, 'red');
  assert.equal(app.programContext(otherKey).readiness, 'green');

  STATE.pickupDays = ['friday'];
  STATE.pickupWeekKey = '1:1';
  assert.deepEqual(app.activePickupDays(), ['friday']);
  STATE.program.weekInBlock = 1;
  assert.deepEqual(app.activePickupDays(), []);
});

test('durable import replacement does not retain fields missing from the backup', () => {
  STATE.log = {stale:{setsLogged:{}}};
  STATE.testResults = {stale:{estimated1rm:999}};
  app.applyDurableData({maxes:{snatch:160},program:{blockId:1,weekInBlock:0},cycleId:2});
  assert.equal(STATE.maxes.snatch,160);
  assert.equal(STATE.maxes.cj,205);
  assert.deepEqual(STATE.log,{});
  assert.deepEqual(STATE.testResults,{});
  assert.equal(STATE.cycleId,2);
});

test('active interval phase and timers survive a persistence round trip', () => {
  STATE.activeWorkout = {startedAt:Date.now(),cycleId:1,programWeek:1,loadOverrides:{},receivingOverrides:{},stoppedExercises:{}};
  STATE.sessionTimer = {active:true,start:Date.now()-1000,interval:null};
  STATE.intervalTimer = {
    active:true,config:{warmupSec:720,rounds:4,workSec:180,restSec:180,lastRest:false,cooldownSec:480},
    phases:[{type:'warmup',sec:720,round:0}],phaseIdx:0,phaseEnd:Date.now()+600000,
    paused:true,pauseRemaining:321000,interval:null,lastCue:-1,startedAt:Date.now()-5000,
  };
  app.save();
  STATE.intervalTimer.active = false;
  STATE.activeWorkout = null;
  app.load();
  assert.ok(STATE.activeWorkout);
  assert.equal(STATE._restoreTimers.interval.paused,true);
  assert.equal(STATE._restoreTimers.interval.pauseRemaining,321000);
  assert.equal(STATE._restoreTimers.interval.config.rounds,4);
});
