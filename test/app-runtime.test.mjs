import assert from 'node:assert/strict';
import test from 'node:test';

await import('../public/app-runtime.js');

const { isLocalDemoHost, isEventOpen, passwordsMatch, routeFromPath, pathForScreen } = globalThis.APP_RUNTIME;
const event = { id: 'e1', slug: 'summer-market' };

test('demo hosts are restricted to local development', () => {
  assert.equal(isLocalDemoHost('localhost'), true);
  assert.equal(isLocalDemoHost('127.0.0.1'), true);
  assert.equal(isLocalDemoHost('orders.example.com'), false);
});

test('orders are allowed only while an event is open', () => {
  assert.equal(isEventOpen({ manual_status: 'open' }), true);
  for (const manual_status of ['draft', 'scheduled', 'closed', undefined]) {
    assert.equal(isEventOpen({ manual_status }), false);
  }
  assert.equal(isEventOpen(null), false);
});

test('password confirmation must exactly match the new password', () => {
  assert.equal(passwordsMatch('', ''), true);
  assert.equal(passwordsMatch('new password', 'new password'), true);
  assert.equal(passwordsMatch('new password', 'different password'), false);
  assert.equal(passwordsMatch('new password', ''), false);
});

test('event routes restore their screen and selected event', () => {
  assert.deepEqual(routeFromPath('/events/summer-market', [event]), { screen: 'event', event, invalid: false });
  assert.deepEqual(routeFromPath('/events/summer-market/edit', [event]), { screen: 'event-edit', event, invalid: false });
  assert.deepEqual(routeFromPath('/events/summer-market/reports', [event]), { screen: 'reports', event, invalid: false });
  assert.deepEqual(routeFromPath('/events/summer-market/orders', [event]), { screen: 'orders', event, invalid: false });
});

test('screen paths round-trip and invalid paths fall back safely', () => {
  for (const screen of ['event', 'event-edit', 'reports', 'orders']) {
    const route = routeFromPath(pathForScreen(screen, event), [event]);
    assert.equal(route.screen, screen);
    assert.equal(route.event, event);
  }
  assert.deepEqual(routeFromPath('/events/missing', [event]), { screen: 'events', event: null, invalid: true });
  assert.equal(pathForScreen('accounts'), '/accounts');
  assert.equal(pathForScreen('settings'), '/settings');
});
