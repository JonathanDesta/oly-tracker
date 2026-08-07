'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PROGRAM } = require('../js/program.js');

const GREEN = { readiness: 'green', pickupDays: [], pickupTiming: {}, copenhagen: { step: 1, load: 0 }, technicalProgress: { hhSnatchPct: 65 } };

function raw(blockId, weekInBlock, dayKey) {
  return PROGRAM.getDayWorkout(blockId, weekInBlock, dayKey);
}

function flat(day) {
  return (day.sections || []).flatMap(sec => sec.exercises);
}

function ex(day, id, nth = 0) {
  const matches = flat(day).filter(item => item.id === id);
  assert.ok(matches[nth], `${id} occurrence ${nth} is scheduled`);
  return matches[nth];
}

function plan(blockId, weekInBlock, dayKey, cutting = false, context = GREEN) {
  return PROGRAM.getDayPlan(blockId, weekInBlock, dayKey, cutting, context);
}

test('13-week calendar is contiguous and all exercise ids resolve', () => {
  assert.deepEqual(PROGRAM.blocks.map(b => b.startWeek), [1, 4, 5, 8, 9, 12, 13]);
  assert.deepEqual(PROGRAM.blocks.map(b => b.weeks), [3, 1, 3, 1, 3, 1, 1]);
  for (const block of PROGRAM.blocks) {
    for (let w = 0; w < block.weeks; w++) {
      for (const dayKey of PROGRAM.dayKeys) {
        const day = raw(block.id, w, dayKey);
        assert.ok(day, `${block.name} ${dayKey}`);
        for (const item of flat(day)) assert.ok(PROGRAM.exercises[item.id], item.id);
      }
    }
  }
});

test('competition-lift ladder matches weeks 1 through 11', () => {
  const loading = [
    [1,0,5,65,5,65,5,75,5,75], [1,1,5,70,5,70,5,80,5,80], [1,2,5,72.5,5,72.5,5,82.5,5,82.5],
    [3,0,5,72.5,5,72.5,5,82.5,5,82.5], [3,1,5,75,5,75,5,85,5,85], [3,2,5,77.5,5,77.5,4,87.5,4,87.5],
    [5,0,4,75,4,75,4,85,4,85], [5,1,4,77.5,4,77.5,4,87.5,4,87.5], [5,2,4,80,4,80,3,90,3,90],
  ];
  for (const [b,w,ms,mp,ts,tp,ths,thp,fs,fp] of loading) {
    assert.deepEqual([ex(raw(b,w,'monday'),'snatch_floor').sets, ex(raw(b,w,'monday'),'snatch_floor').pct], [ms,mp]);
    assert.deepEqual([ex(raw(b,w,'tuesday'),'cj_floor').sets, ex(raw(b,w,'tuesday'),'cj_floor').pct], [ts,tp]);
    assert.deepEqual([ex(raw(b,w,'thursday'),'snatch_floor').sets, ex(raw(b,w,'thursday'),'snatch_floor').pct], [ths,thp]);
    assert.deepEqual([ex(raw(b,w,'friday'),'cj_floor').sets, ex(raw(b,w,'friday'),'cj_floor').pct], [fs,fp]);
  }
  assert.equal(ex(raw(2,0,'thursday'),'snatch_floor').sets, 3);
  assert.equal(ex(raw(4,0,'friday'),'cj_floor').sets, 3);
});

test('week 11 conditional fourth singles are distinct and cut-capped', () => {
  const thu = raw(5, 2, 'thursday');
  const fri = raw(5, 2, 'friday');
  assert.equal(ex(thu, 'snatch_floor', 0).sets, 3);
  assert.equal(ex(thu, 'snatch_floor', 1).optionalTopSingle, true);
  assert.notEqual(ex(thu, 'snatch_floor', 0).slotKey, ex(thu, 'snatch_floor', 1).slotKey);
  assert.equal(ex(fri, 'cj_floor', 1).optionalTopSingle, true);
  assert.equal(ex(fri, 'jerk_rack_heavy', 1).optionalTopSingle, true);
  for (const dayKey of ['thursday', 'friday']) {
    assert.ok(flat(PROGRAM.applyCutting(raw(5, 2, dayKey))).filter(x => x.optionalTopSingle).every(x => x.pct === 87.5));
  }
  assert.equal(flat(plan(5, 2, 'thursday', false, { ...GREEN, readiness: 'yellow' })).some(x => x.optionalTopSingle), false);
  assert.equal(flat(plan(5, 2, 'friday', false, { ...GREEN, readiness: 'red' })).some(x => x.optionalTopSingle), false);
});

test('accessory ramp applies after gain/cut slot selection', () => {
  assert.equal(ex(raw(1,0,'monday'),'incline_db_press').sets, 3);
  // Intro ramp collapsed to week 1 only: week 2 is full prescription
  // (movements familiar, consistent training history — the multi-week
  // intro had no evidential basis for this lifter).
  assert.equal(ex(raw(1,1,'monday'),'incline_db_press').sets, 4);
  assert.equal(ex(raw(1,1,'wednesday'),'cable_lateral').sets, 5);
  assert.equal(ex(PROGRAM.applyCutting(raw(1,0,'monday')),'incline_db_press').sets, 2);
  assert.equal(ex(PROGRAM.applyCutting(raw(1,0,'monday')),'cable_lateral_behind').sets, 1);
  assert.equal(ex(raw(3,0,'monday'),'incline_db_press').sets, 3);
  assert.equal(ex(raw(3,1,'monday'),'incline_db_press').sets, 4);
  assert.equal(ex(raw(5,0,'wednesday'),'cable_lateral').sets, 4);
  assert.equal(ex(raw(5,1,'wednesday'),'cable_lateral').sets, 5);
  assert.equal(ex(raw(1,0,'tuesday'),'copenhagen').sets, 1);
});

test('Nordic is Friday-only and globally progresses after week 2', () => {
  for (const dayKey of PROGRAM.dayKeys.filter(d => d !== 'friday')) {
    assert.equal(flat(raw(1,0,dayKey)).some(x => x.id === 'nordic'), false);
  }
  assert.equal(ex(raw(1,0,'friday'),'nordic').reps, '3');
  assert.equal(ex(raw(1,1,'friday'),'nordic').reps, '3');
  assert.equal(ex(raw(1,2,'friday'),'nordic').reps, '4–6');
  assert.equal(ex(raw(3,0,'friday'),'nordic').reps, '4–6');
});

test('field drills are split, equipment decides separate-AM vs opens-the-lift', () => {
  // [block, tuesdayDrills, tuesdayMerged, thursdayDrills, thursdayMerged]
  const phases = [
    [1, ['pogo_hops','cmj','broad_jump','lateral_bound','accel_stop','shuttle_5105'], false,
        ['sled_sprint','sprint_20'], true],
    [3, ['pogo_hops','drop_jump','broad_jump','lateral_bound','shuttle_5105','reactive_drill'], true,
        ['sled_sprint','sprint_build_20','flying_20'], true],
    [5, ['hurdle_hop','cmj','broad_jump','reactive_drill'], true,
        ['sprint_10','sprint_30'], false],
  ];
  for (const [b, tueDrills, tueMerged, thuDrills, thuMerged] of phases) {
    for (const [dayKey, drills, merged] of [['tuesday',tueDrills,tueMerged],['thursday',thuDrills,thuMerged]]) {
      const p = plan(b, 0, dayKey);
      const fieldSess = p.sessions.find(s => s.kind === 'field');
      const lifting = p.sessions.find(s => s.kind === 'lifting');
      const mergedSec = (lifting.sections || []).find(sec => sec.fieldSection);
      assert.equal(!!mergedSec, merged, `${dayKey} b${b} merged`);
      assert.equal(!!fieldSess, !merged, `${dayKey} b${b} separate`);
      const host = merged ? mergedSec : fieldSess.sections[0];
      const ids = host.exercises.map(e => e.id);
      assert.equal(ids[0], 'field_warmup', `${dayKey} b${b} field warm-up first`);
      assert.deepEqual(ids.slice(1), drills, `${dayKey} b${b} drills`);
      host.exercises.slice(1).forEach(e => {
        assert.ok(Number(e.sets) >= 1 && e.rest >= 60, `${dayKey} b${b} ${e.id} loggable sets/rest`);
      });
      if (merged) { // field opens the session: prep comes AFTER the field block
        assert.ok(lifting.sections[0].fieldSection, `${dayKey} b${b} field first`);
        assert.ok(lifting.sections[1].title === 'Prep', `${dayKey} b${b} prep second`);
      }
      // deloads: same placement, halved drill sets
      const db = b === 1 ? 2 : b === 3 ? 4 : null;
      if (db) {
        const dp = plan(db, 0, dayKey);
        const dLift = dp.sessions.find(s => s.kind === 'lifting');
        const dSec = (dLift.sections || []).find(sec => sec.fieldSection)
          || dp.sessions.find(s => s.kind === 'field')?.sections[0];
        const full = Object.fromEntries(host.exercises.slice(1).map(e => [e.id, e.sets]));
        dSec.exercises.slice(1).forEach(e => {
          assert.equal(e.sets, Math.max(1, Math.ceil(full[e.id] / 2)), `deload ${dayKey} ${e.id} halved`);
        });
      }
    }
  }
  const durations = {
    monday: [['main',105]], tuesday: [['field',35],['main',130]],
    wednesday: [['main',110],['cardio',35]], thursday: [['main',120]],
    friday: [['main',120]], saturday: [['main',75]],
  };
  for (const [dayKey, pairs] of Object.entries(durations)) {
    const p = plan(1, 2, dayKey);
    assert.deepEqual(p.sessions.map(s => [s.id,s.totalMin]), pairs);
    for (const s of p.sessions) {
      const prepIds = (s.sections || []).flatMap(sec => sec.exercises)
        .filter(x => x.id.startsWith('prep_')).map(x => x.id);
      if (s.kind !== 'lifting') { assert.equal(prepIds.length, 0); continue; }
      const expected = {
        monday: 'prep_bar_snatch', tuesday: 'prep_bar_cj', wednesday: 'prep_bar_mixed',
        thursday: 'prep_bar_snatch', friday: 'prep_bar_cj', saturday: 'prep_accessories',
      }[dayKey];
      assert.deepEqual(prepIds, [expected], `${dayKey} prep`);
    }
  }
});

test('bike interval engine contains the complete warm-up, work, recovery, and cool-down', () => {
  for (const [b,w,work] of [[1,0,180],[3,0,240],[5,0,240]]) {
    const item = ex(raw(b,w,'saturday'),'bike_intervals');
    assert.deepEqual(item.interval, { warmupSec:720, rounds:4, workSec:work, restSec:180, lastRest:false, cooldownSec:480 });
  }
  assert.equal(ex(PROGRAM.applyCutting(raw(5,2,'saturday')),'bike_intervals').interval.workSec, 180);
  for (const b of [2,4,6,7]) assert.equal(flat(raw(b,0,'saturday')).some(x => x.id === 'bike_intervals'), false);
});

test('cut transform is pure and preserves priority-one structure while reducing C slots', () => {
  const gain = raw(5,2,'thursday');
  const before = JSON.stringify(gain);
  const cut = PROGRAM.applyCutting(gain);
  assert.equal(JSON.stringify(gain), before);
  assert.equal(ex(cut,'snatch_floor',0).sets, ex(gain,'snatch_floor',0).sets);
  assert.equal(ex(cut,'snatch_floor',0).pct, 87.5);
  assert.equal(ex(cut,'back_squat').sets, 3);
  assert.equal(ex(cut,'cable_lateral').sets, 3);
  assert.equal(cut.sessionMinutes.main, gain.sessionMinutes.main - 15);
});

test('pickup matrix and same-day timing apply without mutating the base plan', () => {
  // Tuesday b1 field is a SEPARATE session -> skipped; Thursday b1 field is
  // MERGED into the lift -> its section is removed from the lifting session.
  for (const pickup of ['monday','tuesday']) {
    const p = plan(1,2,'tuesday',false,{...GREEN,pickupDays:[pickup]});
    assert.equal(p.sessions.find(s => s.id === 'field').skipped, true, `tue field skipped on ${pickup} pickup`);
  }
  for (const pickup of ['wednesday','thursday']) {
    const p = plan(1,2,'thursday',false,{...GREEN,pickupDays:[pickup]});
    const lifting = p.sessions.find(s => s.kind === 'lifting');
    assert.equal((lifting.sections || []).some(sec => sec.fieldSection), false, `thu merged field removed on ${pickup} pickup`);
    assert.equal(flat({sections:lifting.sections}).some(x => x.id === 'sled_sprint'), false);
    // barbell work untouched
    assert.ok(flat({sections:lifting.sections}).some(x => x.id === 'snatch_floor'));
  }
  // b5 Thursday field is separate again -> plain skip
  const b5 = plan(5,0,'thursday',false,{...GREEN,pickupDays:['thursday']});
  assert.equal(b5.sessions.find(s => s.id === 'field').skipped, true);
  for (const pickup of ['wednesday','friday','saturday']) {
    const sat = plan(1,2,'saturday',false,{...GREEN,pickupDays:[pickup]});
    assert.equal(flat({ sections: sat.sessions[0].sections }).some(x => x.id === 'bike_intervals'), false);
  }
  const before = plan(1,2,'friday');
  const beforePickup = plan(1,2,'friday',false,{...GREEN,pickupDays:['friday'],pickupTiming:{friday:'before'}});
  assert.equal(flat({sections:beforePickup.sessions[0].sections}).some(x => ['front_squat','rdl'].includes(x.id)), false);
  assert.ok(flat({sections:beforePickup.sessions[0].sections}).filter(x => x.pct && ['oly','technical'].includes(PROGRAM.exercises[x.id].type)).every(x => x.pct <= 70));
  assert.ok(flat({sections:before.sessions[0].sections}).some(x => x.id === 'front_squat'));
});

test('readiness transforms remove unsafe work and keep ramp steps below transformed loads', () => {
  const yellow = plan(5,2,'thursday',false,{...GREEN,readiness:'yellow'});
  const yellowMain = yellow.sessions.find(s => s.id === 'main');
  const yellowItems = flat({sections:yellowMain.sections});
  assert.equal(yellowItems.some(x => x.optionalTopSingle), false);
  assert.equal(ex({sections:yellowMain.sections},'back_squat').sets, 2);
  for (const item of yellowItems.filter(x => x.buildup?.some(s => s.pct != null))) {
    assert.ok(item.buildup.every(step => step.pct < item.pct), `${item.id} ramp below ${item.pct}`);
  }
  const red = plan(5,2,'saturday',false,{...GREEN,readiness:'red'});
  assert.equal(red.sessions[0].skipped, true);
  const redThu = plan(5,2,'thursday',false,{...GREEN,readiness:'red'});
  assert.equal(redThu.sessions.find(s => s.id === 'field').skipped, true);
  const work = flat({sections:redThu.sessions.find(s => s.id === 'main').sections});
  assert.ok(work.every(x => ['oly','technical','warmup','mobility'].includes(PROGRAM.exercises[x.id].type)));
  assert.ok(work.filter(x => x.pct).every(x => x.pct <= 60));

  const yellowTuesday = plan(1,2,'tuesday',false,{...GREEN,readiness:'yellow'});
  const yF = yellowTuesday.sessions.find(s => s.id === 'field');
  assert.equal(ex({sections:yF.sections},'cmj').sets, 2);          // 3 -> x0.75 -> 2
  assert.equal(ex({sections:yF.sections},'pogo_hops').sets, 2);    // 2 -> stays >=1
  assert.ok(yF.totalMin < 35);
  // merged field on yellow: drill sets reduced inside the lifting session too
  const yThu = plan(1,2,'thursday',false,{...GREEN,readiness:'yellow'});
  const yLift = yThu.sessions.find(s => s.kind === 'lifting');
  assert.equal(ex({sections:yLift.sections},'sled_sprint').sets, 2);
  const yellowSaturday = plan(3,2,'saturday',false,{...GREEN,readiness:'yellow'});
  assert.equal(ex({sections:yellowSaturday.sessions[0].sections},'bike_intervals').interval.rounds, 3);
  assert.ok(yellowSaturday.sessions[0].totalMin < 70);
});

test('deload, taper, and test week preserve their special rules', () => {
  assert.equal(ex(raw(2,0,'wednesday'),'zone2').duration, '30–40 min');
  assert.equal(ex(raw(2,0,'saturday'),'zone2').duration, '25–35 min');
  assert.equal(ex(raw(6,0,'tuesday'),'jerk_rack').pct, 67.5);
  assert.equal(ex(raw(6,0,'wednesday'),'hh_clean').receivingDepth, true);
  assert.equal(ex(raw(2,0,'wednesday'),'hh_snatch').receivingDepth, true);
  assert.equal(flat(raw(6,0,'friday')).filter(x => PROGRAM.exercises[x.id].type === 'hypertrophy').length, 0);
  assert.deepEqual(raw(7,0,'friday').lifts.map(x => x.lift), ['bs','fs','bench']);
  assert.equal(ex(raw(7,0,'wednesday'),'zone2').duration, '20 min easy');
  assert.equal(PROGRAM.estimate1RM(315,2,7), 367.5);
  assert.equal(PROGRAM.estimate1RM(315,2,8), 355);
  assert.equal(PROGRAM.estimate1RM(315,2,9), 342.5);

  const pickupBeforeTest = plan(7,0,'friday',false,{...GREEN,pickupDays:['friday'],pickupTiming:{friday:'before'}});
  assert.equal(pickupBeforeTest.sessions[0].skipped, true);
});

test('Copenhagen context selects all five progressive variations', () => {
  for (let step = 1; step <= 5; step++) {
    const p = plan(1,2,'tuesday',false,{...GREEN,copenhagen:{step,load:step === 5 ? 25 : 0}});
    const item = ex({sections:p.sessions.find(s => s.id === 'main').sections},'copenhagen');
    assert.equal(item.copenhagenStep, step);
    assert.equal(item.duration, PROGRAM.copenhagenSteps[step].duration);
    assert.equal(item.externalLoad, step === 5 ? 25 : 0);
  }
});
