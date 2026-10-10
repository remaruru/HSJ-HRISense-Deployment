import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LoginCaptchaTracker } from '../login-captcha';

const rules = { perEmail: 3, perIp: 10, windowMs: 15 * 60 * 1000 };

function tracker() {
  let t = 1_000_000;
  const tr = new LoginCaptchaTracker(rules, () => t);
  return { tr, advance: (ms: number) => (t += ms) };
}

describe('sign-in checkbox — when it is required', () => {
  test('not required for a normal sign-in', () => {
    const { tr } = tracker();
    assert.equal(tr.isRequired('ana@example.com', '1.1.1.1'), false);
  });

  test('required after 3 failures for one email, whatever the case or spacing', () => {
    const { tr } = tracker();
    assert.equal(tr.recordFailure('Ana@Example.com', '1.1.1.1'), false);
    assert.equal(tr.recordFailure(' ana@example.com', '2.2.2.2'), false);
    assert.equal(tr.recordFailure('ana@example.com ', '3.3.3.3'), true);
    assert.equal(tr.isRequired('ANA@example.com', '9.9.9.9'), true);
  });

  test('required for every email after 10 failures from one network', () => {
    const { tr } = tracker();
    for (let i = 0; i < 10; i++) tr.recordFailure(`person${i}@example.com`, '5.5.5.5');
    assert.equal(tr.isRequired('someone-new@example.com', '5.5.5.5'), true);
    assert.equal(tr.isRequired('someone-new@example.com', '6.6.6.6'), false);
  });

  test('a successful sign-in clears that email', () => {
    const { tr } = tracker();
    for (let i = 0; i < 3; i++) tr.recordFailure('ana@example.com', `10.0.0.${i}`);
    tr.recordSuccess('ana@example.com');
    assert.equal(tr.isRequired('ana@example.com', '10.0.0.99'), false);
  });

  test('failures are forgotten after the window', () => {
    const { tr, advance } = tracker();
    for (let i = 0; i < 3; i++) tr.recordFailure('ana@example.com', '1.1.1.1');
    advance(rules.windowMs + 1);
    assert.equal(tr.isRequired('ana@example.com', '1.1.1.1'), false);
  });

  test('the window starts at the first failure, not the latest', () => {
    const { tr, advance } = tracker();
    tr.recordFailure('ana@example.com', '1.1.1.1');
    advance(rules.windowMs - 1000);
    tr.recordFailure('ana@example.com', '1.1.1.1');
    advance(2000);
    // The first failure's window has ended, so the count starts again.
    assert.equal(tr.recordFailure('ana@example.com', '1.1.1.1'), false);
  });

  test('an email that has no account is counted exactly like one that does', () => {
    const { tr } = tracker();
    for (let i = 0; i < 3; i++) tr.recordFailure('nobody@example.com', '1.1.1.1');
    assert.equal(tr.isRequired('nobody@example.com', '7.7.7.7'), true);
  });
});
