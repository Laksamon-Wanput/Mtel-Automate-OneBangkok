import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const expectedItem = JSON.parse(
  readFileSync(new URL('../../test-data/example-item.json', import.meta.url), 'utf8'),
);

test('GET an item and compare it with data from test-data', async ({ request }) => {
  // This local endpoint makes the example runnable without an external API.
  const server = createServer((incoming, response) => {
    if (incoming.method === 'GET' && incoming.url === '/items/42') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: 42, name: 'Example item', status: 'active' }));
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    const response = await request.get(`http://127.0.0.1:${address.port}/items/42`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(expectedItem);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
