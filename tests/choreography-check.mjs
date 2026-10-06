import assert from 'node:assert/strict';
import { FILM_SECONDS, smooth, makeChoreography, cameraAt } from '../src/webgl/choreography.js';

console.log('Testing FILM_SECONDS...');
assert.equal(FILM_SECONDS, 118);

console.log('Testing smooth...');
assert.equal(smooth(0, 10, -1), 0);
assert.equal(smooth(0, 10, 0), 0);
assert.equal(smooth(0, 10, 5), 0.5);
assert.equal(smooth(0, 10, 10), 1);
assert.equal(smooth(0, 10, 12), 1);

console.log('Testing makeChoreography...');
const count = 1536;
const choreo = makeChoreography(count);
assert(Array.isArray(choreo.frames), 'frames must be an array');
assert(choreo.frames.length >= 30, 'frames must have >= 30 beats');

const firstFrame = choreo.frames[0];
const lastFrame = choreo.frames[choreo.frames.length - 1];
assert.equal(firstFrame.time, 0, 'first frame must be at t=0');
assert.equal(lastFrame.time, 118, 'last frame must be at t=118');

// Verify sorted order
for (let i = 1; i < choreo.frames.length; i++) {
  assert(choreo.frames[i].time >= choreo.frames[i - 1].time, `frames must be sorted: frame ${i} (${choreo.frames[i].time}) < frame ${i-1} (${choreo.frames[i-1].time})`);
}

// Verify all numbers finite, scales positive
choreo.frames.forEach((frame, fi) => {
  assert(frame.positions instanceof Float32Array, `frame ${fi} positions must be Float32Array`);
  assert(frame.scales instanceof Float32Array, `frame ${fi} scales must be Float32Array`);
  assert(frame.rotations instanceof Float32Array, `frame ${fi} rotations must be Float32Array`);
  assert.equal(frame.positions.length, count * 3);
  assert.equal(frame.scales.length, count * 3);
  assert.equal(frame.rotations.length, count * 3);

  for (let i = 0; i < count * 3; i++) {
    assert(Number.isFinite(frame.positions[i]), `frame ${fi} pos[${i}] non-finite: ${frame.positions[i]}`);
    assert(Number.isFinite(frame.scales[i]), `frame ${fi} scale[${i}] non-finite: ${frame.scales[i]}`);
    assert(frame.scales[i] > 0, `frame ${fi} scale[${i}] must be positive: ${frame.scales[i]}`);
    assert(Number.isFinite(frame.rotations[i]), `frame ${fi} rot[${i}] non-finite: ${frame.rotations[i]}`);
  }
});

// Determinism check
const choreo2 = makeChoreography(count);
for (let fi = 0; fi < choreo.frames.length; fi++) {
  const f1 = choreo.frames[fi];
  const f2 = choreo2.frames[fi];
  assert.equal(f1.time, f2.time);
  assert.equal(f1.name, f2.name);
  for (let i = 0; i < count * 3; i++) {
    assert.equal(f1.positions[i], f2.positions[i]);
    assert.equal(f1.scales[i], f2.scales[i]);
    assert.equal(f1.rotations[i], f2.rotations[i]);
  }
}

// Mobile pool check (768 instances)
const mobileChoreo = makeChoreography(768);
assert.equal(mobileChoreo.frames.length, choreo.frames.length);
assert.equal(mobileChoreo.frames[0].positions.length, 768 * 3);
assert.throws(() => makeChoreography(-1), RangeError);

console.log('Testing cameraAt values & boundary continuity...');
const eps = 1e-4;
const values = camera => [...camera.position, ...camera.target, camera.roll, camera.fov];
for (const aspect of [16 / 9, 1, 9 / 16]) {
  for (const { time } of choreo.frames) {
    const at = values(cameraAt(time, aspect));
    const before = values(cameraAt(time - eps, aspect));
    const after = values(cameraAt(time + eps, aspect));
    at.forEach((v, axis) => {
      assert(Number.isFinite(v), `camera at ${time}, axis ${axis}`);
      assert(Math.abs(after[axis] - before[axis]) < 0.005, `camera position discontinuity at ${time}, axis ${axis}`);
      const leftVelocity = (v - before[axis]) / eps;
      const rightVelocity = (after[axis] - v) / eps;
      assert(Math.abs(leftVelocity - rightVelocity) < 0.02, `camera velocity discontinuity at ${time}, axis ${axis}`);
    });
  }
  const frozen = cameraAt(94.5, aspect);
  for (const time of [94.6, 95, 95.5, 96]) assert.deepEqual(cameraAt(time, aspect), frozen);
  for (let time = 0; time <= FILM_SECONDS; time += 0.125) {
    const camera = cameraAt(time, aspect);
    assert(values(camera).every(Number.isFinite));
    assert(camera.fov > 10 && camera.fov <= 100);
    assert(camera.position[2] >= 7.8, 'camera stays outside formations');
  }
}

// Mobile frames preserve finite, positive transforms and valid network endpoints.
for (const { frames, links } of [choreo, mobileChoreo, makeChoreography(1), makeChoreography(17)]) {
  const n = frames[0].positions.length / 3;
  for (const frame of frames) {
    for (const field of ['positions', 'scales', 'rotations']) assert(frame[field].every(Number.isFinite));
    assert(frame.scales.every(scale => scale > 0));
  }
  for (const { a, b } of links) assert(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < n && b < n && a !== b);
}
const frameAt = time => choreo.frames.find(frame => frame.time === time);
for (const [start, end, name] of [[22, 24, 'CODEX'], [46, 48, 'CLAUDE'], [70, 71, 'GEMINI'], [91, 94, 'GROK'], [94.5, 96, 'GROK']]) {
  assert.equal(frameAt(start).name, name);
  for (const field of ['positions', 'scales', 'rotations']) assert.deepEqual(frameAt(start)[field], frameAt(end)[field]);
}
for (let i = 0; i < count; i++) {
  const offset = i * 3;
  assert(Math.abs(Math.hypot(...firstFrame.positions.subarray(offset, offset + 3)) - 1.4) < 1e-6);
  assert(Math.abs(frameAt(18).positions[offset + 1] - frameAt(18).scales[offset + 1] / 2 + 3) < 1e-6, 'city towers rest on floor');
  assert(Math.abs(frameAt(29).positions[offset]) < 5 && Math.abs(frameAt(29).positions[offset + 2]) < 5, 'chip footprint');
}

// Aspect compensation remains continuous, bounded, and preserves horizontal framing.
const cPort = cameraAt(22, 9 / 16), cLand = cameraAt(22, 16 / 9);
const radius = camera => Math.hypot(...camera.position.map((v, i) => v - camera.target[i]));
assert(radius(cPort) / radius(cLand) <= 1.6 + 1e-12);
assert(cPort.fov >= cLand.fov);
const halfWidth = (camera, aspect) => radius(camera) * Math.tan(camera.fov * Math.PI / 360) * aspect;
assert(Math.abs(halfWidth(cPort, 9 / 16) - halfWidth(cLand, 16 / 9)) < 1e-8);
assert.deepEqual(cameraAt(-100), cameraAt(0));
assert.deepEqual(cameraAt(200), cameraAt(FILM_SECONDS));
for (const invalid of [0, -1, 1.5, NaN, Infinity, '1536', 65537]) assert.throws(() => makeChoreography(invalid), RangeError);
for (const invalid of [NaN, Infinity, -Infinity, undefined, '1']) assert.throws(() => cameraAt(invalid), RangeError);
for (const invalid of [0, -1, NaN, Infinity, '1']) assert.throws(() => cameraAt(1, invalid), RangeError);

console.log(`${choreo.frames.length} choreography frames passed: deterministic geometry, desktop/mobile, C1 camera continuity, freeze, portrait framing.`);
