import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';

function cloneEnv() {
  const statements = [];
  const source = {
    id: 'e1', slug: 'source-event', name: 'Source event', currency_unit: 'HKD', currency_scale: 2,
    timezone: 'Asia/Hong_Kong', start_at: '2026-08-01T01:00:00.000Z', end_at: '2026-08-02T10:00:00.000Z', manual_status: 'closed'
  };
  const products = [{ id: 'p1', event_id: 'e1', name: 'Badge', image_key: '/media/events/e1/badge.png', price_minor: 1200, sort_order: 3, active: 1 }];
  const gifts = [{ id: 'g1', event_id: 'e1', threshold_minor: 5000, gift_name: 'Poster', mode: 'highest', sort_order: 0, active: 1 }];
  const env = {
    DB: {
      prepare(sql) {
        const statement = {
          sql,
          values: [],
          bind(...values) { this.values = values; return this; },
          async first() {
            if (sql.includes('FROM sessions')) return { id: 'u1', role: 'admin', status: 'active' };
            if (sql === 'SELECT * FROM events WHERE id=?') return source;
            if (sql.includes('INSERT INTO audit_logs')) return null;
            throw new Error(`Unexpected first query: ${sql}`);
          },
          async all() {
            if (sql.includes('FROM products')) return { results: products };
            if (sql.includes('FROM gift_rules')) return { results: gifts };
            throw new Error(`Unexpected all query: ${sql}`);
          },
          async run() { statements.push({ sql: this.sql, values: this.values }); return { success: true }; }
        };
        return statement;
      },
      async batch(items) { statements.push(...items.map(item => ({ sql: item.sql, values: item.values }))); return []; }
    }
  };
  return { env, source, products, gifts, statements };
}

test('event cloning copies active products and gift rules with requested event fields', async () => {
  const { env, source, products, gifts, statements } = cloneEnv();
  const request = new Request('https://orders.example.com/api/events/e1/clone', {
    method: 'POST',
    headers: { cookie: 'sid=test-session', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Copied event', manual_status: 'scheduled', start_at: '2026-09-01T01:00:00.000Z', end_at: '2026-09-02T10:00:00.000Z' })
  });

  const response = await worker.fetch(request, env);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.event.name, 'Copied event');
  assert.equal(body.event.manual_status, 'scheduled');
  assert.equal(body.event.start_at, '2026-09-01T01:00:00.000Z');
  assert.equal(body.event.end_at, '2026-09-02T10:00:00.000Z');
  assert.equal(body.event.currency_unit, source.currency_unit);
  assert.equal(body.products.length, products.length);
  assert.equal(body.products[0].event_id, body.event.id);
  assert.notEqual(body.products[0].id, products[0].id);
  assert.equal(body.products[0].image_key, products[0].image_key);
  assert.equal(body.gifts.length, gifts.length);
  assert.equal(body.gifts[0].event_id, body.event.id);
  assert.notEqual(body.gifts[0].id, gifts[0].id);
  assert.ok(statements.some(statement => statement.sql.includes('INSERT INTO events')));
  assert.ok(statements.some(statement => statement.sql.includes('INSERT INTO products')));
  assert.ok(statements.some(statement => statement.sql.includes('INSERT INTO gift_rules')));
});

test('event cloning requires a name', async () => {
  const { env } = cloneEnv();
  const request = new Request('https://orders.example.com/api/events/e1/clone', {
    method: 'POST',
    headers: { cookie: 'sid=test-session', 'content-type': 'application/json' },
    body: JSON.stringify({ manual_status: 'draft' })
  });

  const response = await worker.fetch(request, env);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Event name is required' });
});
