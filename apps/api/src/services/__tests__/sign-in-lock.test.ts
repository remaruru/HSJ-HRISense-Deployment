import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SignInLock, waitPhrase } from '../sign-in-lock';

const steps = [15, 30, 60, 900];
const memoryMs = 60 * 60 * 1000;

function lock() {
  let t = 1_000_000;
  const l = new SignInLock(steps, memoryMs, () => t);
  return { l, advance: (ms: number) => (t += ms) };
}

const BROWSER = '3f1c9a2e-7b44-4d1e-9c0a-5b2f8e6d1a90';
const OTHER_BROWSER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('sign-in lock — escalating waits for the failing browser', () => {
  test('a browser that has not failed may try', () => {
    const { l } = lock();
    assert.equal(l.secondsLeft(SignInLock.key('1.1.1.1', BROWSER)), 0);
  });

  test('each wrong sign-in locks longer: 15 s, 30 s, 1 min, then 15 min every time', () => {
    const { l, advance } = lock();
    const key = SignInLock.key('1.1.1.1', BROWSER);
    const waits: number[] = [];
    for (let i = 0; i < 6; i++) {
      const seconds = l.recordFailure(key);
      waits.push(seconds);
      assert.equal(l.secondsLeft(key), seconds);
      advance(seconds * 1000);
      assert.equal(l.secondsLeft(key), 0);
    }
    assert.deepEqual(waits, [15, 30, 60, 900, 900, 900]);
  });

  test('the countdown goes down while the lock runs', () => {
    const { l, advance } = lock();
    const key = SignInLock.key('1.1.1.1', BROWSER);
    l.recordFailure(key);
    advance(10_000);
    assert.equal(l.secondsLeft(key), 5);
  });

  test('another browser on the same network is not locked', () => {
    const { l } = lock();
    l.recordFailure(SignInLock.key('1.1.1.1', BROWSER));
    assert.equal(l.secondsLeft(SignInLock.key('1.1.1.1', OTHER_BROWSER)), 0);
  });

  test('the same browser id on another network is not locked', () => {
    const { l } = lock();
    l.recordFailure(SignInLock.key('1.1.1.1', BROWSER));
    assert.equal(l.secondsLeft(SignInLock.key('2.2.2.2', BROWSER)), 0);
  });

  test('requests without a valid browser id share one lock per network', () => {
    const { l } = lock();
    l.recordFailure(SignInLock.key('1.1.1.1', undefined));
    assert.ok(l.secondsLeft(SignInLock.key('1.1.1.1', 'not valid!')) > 0);
    assert.ok(l.secondsLeft(SignInLock.key('1.1.1.1', '')) > 0);
    assert.equal(l.secondsLeft(SignInLock.key('1.1.1.1', BROWSER)), 0);
  });

  test('a successful sign-in starts the browser over at 15 seconds', () => {
    const { l, advance } = lock();
    const key = SignInLock.key('1.1.1.1', BROWSER);
    l.recordFailure(key);
    advance(15_000);
    l.recordFailure(key);
    advance(30_000);
    l.recordSuccess(key);
    assert.equal(l.recordFailure(key), 15);
  });

  test('failures are forgotten after an hour with none', () => {
    const { l, advance } = lock();
    const key = SignInLock.key('1.1.1.1', BROWSER);
    l.recordFailure(key);
    l.recordFailure(key);
    advance(memoryMs);
    assert.equal(l.recordFailure(key), 15);
  });

  test('a running 15-minute lock is not forgotten early', () => {
    const { l, advance } = lock();
    const key = SignInLock.key('1.1.1.1', BROWSER);
    for (let i = 0; i < 4; i++) {
      l.recordFailure(key);
      advance(i < 3 ? steps[i] * 1000 : 0);
    }
    advance(14 * 60 * 1000);
    assert.equal(l.secondsLeft(key), 60);
  });
});

describe('waitPhrase', () => {
  test('seconds below a minute, minutes from then on', () => {
    assert.equal(waitPhrase(1), '1 second');
    assert.equal(waitPhrase(15), '15 seconds');
    assert.equal(waitPhrase(60), '1 minute');
    assert.equal(waitPhrase(900), '15 minutes');
  });
});
