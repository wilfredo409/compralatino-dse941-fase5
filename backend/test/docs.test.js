import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';

test('serves Swagger UI at /api/docs', async () => {
  const response = await request(app).get('/api/docs/');

  assert.equal(response.status, 200);
  assert.match(response.text, /Swagger UI/);
});
