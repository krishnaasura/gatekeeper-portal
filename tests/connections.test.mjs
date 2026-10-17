import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connections, publicUrl, probe } from '../lib/connections.ts';

test('rejects credentials, token queries, non-web schemes and malformed URLs', () => {
  for (const url of ['javascript:alert(1)', 'https://user:pass@host', 'https://host/?token=secret', 'https://host/#secret', 'invalid'])
    assert.throws(() => publicUrl(url));
  assert.equal(publicUrl(' https://argo.example/argo/ '), 'https://argo.example/argo/');
  assert.equal(publicUrl(''), undefined);
});
test('unconfigured endpoints cause no requests', async () => {
  const result = await probe('argo', undefined, undefined, async () => { throw Error('must not fetch'); });
  assert.equal(result.status, 'unconfigured');
});
test('login and redirects are reachable, server errors are unavailable', async () => {
  for (const status of [200, 302, 401, 403, 503]) {
    const result = await probe('argo', 'https://argo.example', undefined, async (url, options) => {
      assert.equal(options.redirect, 'manual');
      return new Response(null, { status });
    });
    assert.equal(result.status, status === 503 ? 'unavailable' : 'reachable');
  }
});
test('TLS failures remain visible without bypassing certificate validation', async () => {
  const result = await probe('headlamp', 'https://headlamp.example', undefined, async () => {
    throw new Error('fetch failed', { cause: { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' } });
  });
  assert.equal(result.status, 'tls-error');
});
test('independent service failures preserve Scout and do not expose probe URLs', async () => {
  const result = await connections({ ARGOCD_URL: 'https://argo.example', HEADLAMP_URL: 'javascript:no',
    ARGOCD_CHECK_URL: 'http://internal-argo', PRICE_SCOUT_ORIGIN: 'http://scout:8091' }, async url => {
    if (String(url).includes('internal-argo')) throw Error('offline');
    assert.equal(url, 'http://scout:8091/price-scout/api/health');
    return Response.json({ healthy: true });
  });
  assert.deepEqual(result.map(item => item.status), ['unavailable', 'invalid', 'online']);
  assert.ok(!JSON.stringify(result).includes('internal-argo'));
});
test('Scout requires healthy JSON, not just a responding web server', async () => {
  const result = await probe('scout', '/price-scout', 'http://scout/health', async () => Response.json({ healthy: false }));
  assert.equal(result.status, 'unavailable');
});
