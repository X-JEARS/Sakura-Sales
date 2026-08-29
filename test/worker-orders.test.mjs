import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';

function blockedOrderEnv(event) {
  const writes = [];
  return {
    writes,
    env: {
      DB: {
        prepare(sql) {
          return {
            bind() { return this; },
            async first() {
              if (sql.includes('FROM sessions')) {
                return { id: 'u1', role: 'admin', status: 'active' };
              }
              if (sql === 'SELECT * FROM events WHERE id=?') return event;
              throw new Error(`Unexpected first query: ${sql}`);
            },
            async run() {
              writes.push(sql);
              return { success: true };
            }
          };
        },
        async batch(statements) {
          writes.push(...statements);
          return [];
        }
      }
    }
  };
}

for (const manual_status of ['draft', 'scheduled', 'closed', 'unknown']) {
  test(`order creation is rejected when event status is ${manual_status}`, async () => {
    const { env, writes } = blockedOrderEnv({ id: 'e1', manual_status });
    const request = new Request('https://orders.example.com/api/events/e1/orders', {
      method: 'POST',
      headers: { cookie: 'sid=test-session', 'content-type': 'application/json' },
      body: JSON.stringify({ client_request_id: 'request-1', items: [{ product_id: 'p1', quantity: 1 }] })
    });

    const response = await worker.fetch(request, env);

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'Event is not open' });
    assert.equal(writes.length, 0);
  });
}

test('order creation is rejected when the event does not exist', async () => {
  const { env, writes } = blockedOrderEnv(null);
  const request = new Request('https://orders.example.com/api/events/missing/orders', {
    method: 'POST',
    headers: { cookie: 'sid=test-session', 'content-type': 'application/json' },
    body: JSON.stringify({ client_request_id: 'request-1', items: [{ product_id: 'p1', quantity: 1 }] })
  });

  const response = await worker.fetch(request, env);

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'Event is not open' });
  assert.equal(writes.length, 0);
});
