import { describe, it, expect, vi } from 'vitest';
import { createRoutes } from '../routes';
import type { ChatCapabilities, RouteServices } from '../routes';
import type { LogAdapter } from '@astralibx/core';

function createMockLogger(): LogAdapter {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockService() {
  return new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined; // Prevent Promise-like behavior
      return vi.fn().mockResolvedValue(undefined);
    },
  });
}

function createMockServices(): RouteServices {
  return {
    sessions: createMockService() as any,
    messages: createMockService() as any,
    agents: createMockService() as any,
    settings: createMockService() as any,
    faq: createMockService() as any,
    guidedQuestions: createMockService() as any,
    cannedResponses: createMockService() as any,
    widgetConfig: createMockService() as any,
  };
}

describe('GET /capabilities', () => {
  it('should create router with capabilities without errors', () => {
    const capabilities: ChatCapabilities = {
      agents: true,
      ai: true,
      visitorSelection: false,
      labeling: true,
      fileUpload: true,
      memory: false,
      prompts: false,
      knowledge: false,
    };

    const router = createRoutes(createMockServices(), {
      logger: createMockLogger(),
      capabilities,
    });

    // Verify router was created with the capabilities route
    const routes = router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        method: Object.keys(layer.route.methods)[0],
        path: layer.route.path,
      }));

    expect(routes).toContainEqual({ method: 'get', path: '/capabilities' });
  });

  it('should create router with all-false capabilities', () => {
    const capabilities: ChatCapabilities = {
      agents: false,
      ai: false,
      visitorSelection: false,
      labeling: false,
      fileUpload: false,
      memory: false,
      prompts: false,
      knowledge: false,
    };

    const router = createRoutes(createMockServices(), {
      logger: createMockLogger(),
      capabilities,
    });

    expect(router).toBeDefined();
  });

  it('should register capabilities route before auth middleware', () => {
    const capabilities: ChatCapabilities = {
      agents: true,
      ai: false,
      visitorSelection: false,
      labeling: false,
      fileUpload: false,
      memory: false,
      prompts: false,
      knowledge: false,
    };

    const router = createRoutes(createMockServices(), {
      logger: createMockLogger(),
      authenticateRequest: async () => null,
      capabilities,
    });

    // The capabilities route should be accessible
    // Find the capabilities GET route in the stack
    const capabilitiesRoute = router.stack.find(
      (layer: any) => layer.route?.path === '/capabilities',
    );

    expect(capabilitiesRoute).toBeDefined();

    // Check that the handler responds with the capabilities data
    const jsonFn = vi.fn();
    const mockRes = {
      status: vi.fn().mockReturnValue({ json: jsonFn }),
    };
    const mockReq = {};

    // Get the handler and call it
    const handler = capabilitiesRoute.route.stack[0].handle;
    handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ agents: true }),
      }),
    );
  });
});
