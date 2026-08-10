import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getOpenApiSpec } from '../services/openapiService.js';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/openapi.json', (req, res) => {
  res.json(getOpenApiSpec());
});

app.get('/api/error-test', (req, res, next) => {
  const err: any = new Error('Test error');
  err.status = 400;
  next(err);
});

app.use((err: any, req: any, res: any, next: any) => {
  res.status(err.status || 500).json({ error: err.message });
});

describe('Server API and OpenAPI Tests', () => {
  it('GET /api/health should return status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/openapi.json should return valid OpenAPI specification', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info.title).toContain('DGMC');
  });

  it('Centralized error handler should catch and return formatted error', async () => {
    const res = await request(app).get('/api/error-test');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Test error');
  });
});
