import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createEmailRuleEngine } from '../index';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 300_000 });

let mongoServer: MongoMemoryServer;
let connection: mongoose.Connection;

const mockRedis: Record<string, any> = {};
const redisMock = {
  get: vi.fn((key: string) => Promise.resolve(mockRedis[key] || null)),
  set: vi.fn((key: string, value: string) => { mockRedis[key] = value; return Promise.resolve('OK'); }),
  del: vi.fn((key: string) => { delete mockRedis[key]; return Promise.resolve(1); }),
  exists: vi.fn((key: string) => Promise.resolve(key in mockRedis ? 1 : 0)),
  hset: vi.fn((key: string, ...args: any[]) => {
    if (!mockRedis[key]) mockRedis[key] = {};
    for (let i = 0; i < args.length; i += 2) {
      mockRedis[key][args[i]] = args[i + 1];
    }
    return Promise.resolve(1);
  }),
  hget: vi.fn((key: string, field: string) => Promise.resolve(mockRedis[key]?.[field] ?? null)),
  hgetall: vi.fn((key: string) => Promise.resolve(mockRedis[key] ?? {})),
  expire: vi.fn(() => Promise.resolve(1)),
  eval: vi.fn(() => Promise.resolve(1)),
  quit: vi.fn(),
};

const queryUsers = vi.fn();
const resolveData = vi.fn((user: any) => user);
const sendEmail = vi.fn();
const selectAgent = vi.fn();
const findIdentifier = vi.fn();

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  connection = await mongoose.createConnection(mongoServer.getUri()).asPromise();
});

afterAll(async () => {
  await connection.close();
  await mongoServer.stop();
});

describe('Email Rule Engine (thin wrapper)', () => {
  let engine: ReturnType<typeof createEmailRuleEngine>;

  beforeAll(() => {
    engine = createEmailRuleEngine({
      db: { connection },
      redis: { connection: redisMock as any },
      adapters: { queryUsers, resolveData, sendEmail, selectAgent, findIdentifier },
      platforms: ['email'],
      audiences: ['customer'],
      categories: ['onboarding'],
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRedis).forEach(k => delete mockRedis[k]);
  });

  it('should create engine with routes and services', () => {
    expect(engine.routes).toBeDefined();
    expect(engine.services.template).toBeDefined();
    expect(engine.services.rule).toBeDefined();
    expect(engine.services.runner).toBeDefined();
  });

  it('should create template and rule', async () => {
    const template = await engine.services.template.create({
      name: 'Welcome Email',
      slug: 'welcome-email',
      category: 'onboarding',
      audience: 'customer',
      platform: 'email',
      subjects: ['Welcome {{name}}!'],
      bodies: ['<mj-text>Hello {{name}}, welcome!</mj-text>'],
    });

    expect(template._id).toBeDefined();

    const rule = await engine.services.rule.create({
      name: 'Welcome Rule',
      platform: 'email',
      templateId: template._id.toString(),
      target: { mode: 'query', role: 'customer', platform: 'email', conditions: [] },
    });

    expect(rule._id).toBeDefined();
  });

  it('should render MJML and call sendEmail adapter', async () => {
    const template = await engine.services.template.create({
      name: 'MJML Test',
      slug: 'mjml-test-' + Date.now(),
      category: 'onboarding',
      audience: 'customer',
      platform: 'email',
      subjects: ['Test'],
      bodies: ['<mj-text>Hello {{name}}</mj-text>'],
    });

    const rule = await engine.services.rule.create({
      name: 'MJML Rule',
      platform: 'email',
      templateId: template._id.toString(),
      target: { mode: 'query', role: 'customer', platform: 'email', conditions: [] },
    });

    await engine.services.rule.toggleActive(rule._id.toString());

    queryUsers.mockResolvedValueOnce([
      { _id: 'user1', contactValue: 'test@example.com', name: 'Alice' },
    ]);
    selectAgent.mockResolvedValueOnce({
      accountId: 'acc1', contactValue: 'sender@example.com', metadata: {},
    });
    findIdentifier.mockResolvedValueOnce({ id: 'ident1', contactId: 'contact1' });
    sendEmail.mockResolvedValueOnce(undefined);

    await engine.services.runner.runAllRules('manual');

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0][0];
    expect(call.htmlBody).toContain('<html');
    expect(call.textBody).toBeDefined();
    expect(call.subject).toBeDefined();
  });
});
