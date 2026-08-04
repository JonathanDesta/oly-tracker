'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PROGRAM } = require('../js/program.js');

const contexts = [
  { readiness:'green', pickupDays:[], pickupTiming:{}, copenhagen:{step:1,load:0}, technicalProgress:{hhSnatchPct:65} },
  { readiness:'yellow', pickupDays:['wednesday'], pickupTiming:{wednesday:'before'}, copenhagen:{step:3,load:0}, technicalProgress:{hhSnatchPct:67.5} },
  { readiness:'red', pickupDays:['friday'], pickupTiming:{friday:'after'}, copenhagen:{step:5,load:25}, technicalProgress:{hhSnatchPct:70} },
];

function exercises(session) {
  return (session.sections || []).flatMap(section => section.exercises || []);
}

test('every transformed day keeps stable, unique session identities', () => {
  for (const block of PROGRAM.blocks) {
    for (let weekInBlock = 0; weekInBlock < block.weeks; weekInBlock++) {
      for (const dayKey of PROGRAM.dayKeys) {
        for (const cutting of [false, true]) {
          for (const context of contexts) {
            const plan = PROGRAM.getDayPlan(block.id, weekInBlock, dayKey, cutting, context);
            const ids = plan.sessions.map(session => session.id);
            assert.equal(new Set(ids).size, ids.length,
              `duplicate session id in block ${block.id}, week ${weekInBlock + 1}, ${dayKey}`);
            assert.ok(ids.every(id => typeof id === 'string' && id.length > 0));
            for (const session of plan.sessions.filter(item => item.skipped)) {
              assert.ok(session.skipReason, `${dayKey}/${session.id} has an explicit skip reason`);
            }
          }
        }
      }
    }
  }
});

test('bodyweight and timed-set prescriptions retain explicit logging metadata', () => {
  assert.equal(PROGRAM.exercises.nordic.bodyweight, true);
  assert.equal(PROGRAM.exercises.hanging_pelvic_curl.bodyweight, true);

  const green = contexts[0];
  const tuesday = PROGRAM.getDayPlan(1, 2, 'tuesday', false, green);
  const copenhagen = tuesday.sessions.flatMap(exercises).find(item => item.id === 'copenhagen');
  assert.ok(copenhagen);
  assert.equal(copenhagen.timedSets, true);
  assert.ok(copenhagen.sets > 0);
  assert.match(copenhagen.duration, /(?:s|sec)\/side/);
});
