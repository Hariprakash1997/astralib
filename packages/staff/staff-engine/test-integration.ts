/**
 * Quick integration test for staff-engine against real MongoDB.
 *
 * Usage:
 *   npx tsx test-integration.ts
 *
 * Requires:
 *   - MongoDB running locally on default port (27017)
 *   - npm install in repo root (workspace deps linked)
 *
 * This script tests the happy path: setup -> login -> CRUD -> permissions -> cleanup
 */

import mongoose from 'mongoose';
import express from 'express';
import { createStaffEngine } from './src/index.js';

const TEST_DB = 'staff_engine_integration_test';
const JWT_SECRET = 'test-secret-do-not-use-in-production';

async function hashPassword(password: string): Promise<string> {
  // Simple hash for testing - use bcrypt in production
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hash).toString('hex');
}

async function comparePassword(plain: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(plain);
  return computed === hash;
}

function log(label: string, data?: unknown) {
  console.log(`\n--- ${label} ---`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

function pass(label: string) {
  console.log(`  PASS: ${label}`);
}

function fail(label: string, error: unknown) {
  console.error(`  FAIL: ${label}`, error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function main() {
  console.log('Staff Engine Integration Test\n');

  // 1. Connect to MongoDB
  log('Connecting to MongoDB');
  const connection = mongoose.createConnection(`mongodb://localhost:27017/${TEST_DB}`);
  await connection.asPromise();
  pass('MongoDB connected');

  // 2. Create engine
  log('Creating staff engine');
  const engine = createStaffEngine({
    db: { connection, collectionPrefix: 'test' },
    auth: { jwtSecret: JWT_SECRET },
    adapters: { hashPassword, comparePassword },
    hooks: {
      onStaffCreated: (staff: any) => console.log(`  Hook: staff created - ${staff.name}`),
      onLogin: (staff: any) => console.log(`  Hook: login - ${staff.name}`),
      onPermissionsChanged: (id, old, next) => console.log(`  Hook: permissions changed - ${old.length} -> ${next.length}`),
      onStatusChanged: (id, old, next) => console.log(`  Hook: status changed - ${old} -> ${next}`),
    },
  });
  pass('Engine created');

  // 3. Mount routes on Express
  const app = express();
  app.use(express.json());
  app.use('/api/staff', engine.routes);
  const server = app.listen(0); // random port
  const port = (server.address() as any).port;
  const base = `http://localhost:${port}/api/staff`;
  pass(`Express listening on port ${port}`);

  const req = async (method: string, path: string, body?: unknown, token?: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { status: res.status, data };
  };

  let ownerToken = '';
  let staffId = '';

  try {
    // 4. Setup - create first owner
    log('POST /setup - create first owner');
    const setupRes = await req('POST', '/setup', {
      name: 'Test Owner',
      email: 'owner@test.com',
      password: 'owner123',
    });
    if (setupRes.status === 201 && setupRes.data.data?.token) {
      ownerToken = setupRes.data.data.token;
      pass(`Owner created, token: ${ownerToken.substring(0, 20)}...`);
    } else {
      fail('Setup failed', setupRes.data);
      return;
    }

    // 5. Setup again should fail
    log('POST /setup - should fail (already complete)');
    const setup2 = await req('POST', '/setup', {
      name: 'Another Owner',
      email: 'owner2@test.com',
      password: 'owner123',
    });
    if (setup2.status === 403) {
      pass('Setup correctly rejected (already complete)');
    } else {
      fail('Setup should have been rejected', setup2);
    }

    // 6. Login
    log('POST /login - owner login');
    const loginRes = await req('POST', '/login', {
      email: 'owner@test.com',
      password: 'owner123',
    });
    if (loginRes.status === 200 && loginRes.data.data?.token) {
      ownerToken = loginRes.data.data.token;
      pass('Login successful');
    } else {
      fail('Login failed', loginRes.data);
      return;
    }

    // 7. Login with wrong password
    log('POST /login - wrong password');
    const badLogin = await req('POST', '/login', {
      email: 'owner@test.com',
      password: 'wrongpassword',
    });
    if (badLogin.status === 401) {
      pass('Wrong password correctly rejected');
    } else {
      fail('Should have been 401', badLogin);
    }

    // 8. GET /me
    log('GET /me - get own profile');
    const meRes = await req('GET', '/me', undefined, ownerToken);
    if (meRes.status === 200 && meRes.data.data?.staff?.name === 'Test Owner') {
      pass(`Profile returned: ${meRes.data.data.staff.name} (${meRes.data.data.staff.role})`);
    } else {
      fail('Get me failed', meRes.data);
    }

    // 9. Create permission group
    log('POST /permission-groups - create chat permissions');
    const groupRes = await req('POST', '/permission-groups', {
      groupId: 'chat',
      label: 'Chat Management',
      permissions: [
        { key: 'chat:view', label: 'View chats', type: 'view' },
        { key: 'chat:edit', label: 'Edit chats', type: 'edit' },
        { key: 'chat:delete', label: 'Delete chats', type: 'action' },
      ],
      sortOrder: 1,
    }, ownerToken);
    if (groupRes.status === 201) {
      pass('Permission group created');
    } else {
      fail('Create group failed', groupRes.data);
    }

    // 10. List permission groups
    log('GET /permission-groups - list groups');
    const groupsRes = await req('GET', '/permission-groups', undefined, ownerToken);
    if (groupsRes.status === 200 && groupsRes.data.data?.length === 1) {
      pass(`Found ${groupsRes.data.data.length} group(s)`);
    } else {
      fail('List groups failed', groupsRes.data);
    }

    // 11. Create staff member
    log('POST / - create staff member');
    const createRes = await req('POST', '/', {
      name: 'Test Staff',
      email: 'staff@test.com',
      password: 'staff123',
      status: 'active',
    }, ownerToken);
    if (createRes.status === 201 && createRes.data.data?._id) {
      staffId = createRes.data.data._id;
      pass(`Staff created: ${staffId}`);
    } else {
      fail('Create staff failed', createRes.data);
    }

    // 12. List staff
    log('GET / - list staff');
    const listRes = await req('GET', '/?page=1&limit=10', undefined, ownerToken);
    if (listRes.status === 200 && listRes.data.data?.data?.length >= 2) {
      pass(`Found ${listRes.data.data.data.length} staff members, total: ${listRes.data.data.pagination?.total}`);
    } else {
      fail('List staff failed', listRes.data);
    }

    // 13. Update permissions
    log('PUT /:staffId/permissions - assign chat:view and chat:edit');
    const permRes = await req('PUT', `/${staffId}/permissions`, {
      permissions: ['chat:view', 'chat:edit'],
    }, ownerToken);
    if (permRes.status === 200) {
      pass('Permissions updated');
    } else {
      fail('Update permissions failed', permRes.data);
    }

    // 14. Try edit without view - should fail
    log('PUT /:staffId/permissions - edit without view should fail');
    const badPermRes = await req('PUT', `/${staffId}/permissions`, {
      permissions: ['chat:edit'],
    }, ownerToken);
    if (badPermRes.status === 400 && badPermRes.data.code === 'STAFF_INVALID_PERMISSIONS') {
      pass('Edit without view correctly rejected');
    } else {
      fail('Should have been rejected', badPermRes.data);
    }

    // 15. Staff login and test permissions
    log('POST /login - staff login');
    const staffLogin = await req('POST', '/login', {
      email: 'staff@test.com',
      password: 'staff123',
    });
    if (staffLogin.status === 200) {
      const staffToken = staffLogin.data.data.token;
      pass('Staff logged in');

      // Staff should be able to access /me
      const staffMe = await req('GET', '/me', undefined, staffToken);
      if (staffMe.status === 200 && staffMe.data.data?.permissions?.length === 2) {
        pass(`Staff has ${staffMe.data.data.permissions.length} permissions`);
      } else {
        fail('Staff /me failed', staffMe.data);
      }

      // Staff should NOT be able to list all staff (owner only)
      const staffList = await req('GET', '/', undefined, staffToken);
      if (staffList.status === 403) {
        pass('Staff correctly denied owner-only route');
      } else {
        fail('Staff should have been denied', staffList);
      }
    } else {
      fail('Staff login failed', staffLogin.data);
    }

    // 16. Deactivate staff
    log('PUT /:staffId/status - deactivate staff');
    const deactRes = await req('PUT', `/${staffId}/status`, {
      status: 'inactive',
    }, ownerToken);
    if (deactRes.status === 200) {
      pass('Staff deactivated');
    } else {
      fail('Deactivate failed', deactRes.data);
    }

    // 17. Deactivated staff cannot login
    log('POST /login - deactivated staff should fail');
    const deactLogin = await req('POST', '/login', {
      email: 'staff@test.com',
      password: 'staff123',
    });
    if (deactLogin.status === 401 && deactLogin.data.code === 'STAFF_ACCOUNT_INACTIVE') {
      pass('Deactivated staff correctly rejected');
    } else {
      fail('Should have been rejected', deactLogin.data);
    }

    // 18. Cannot deactivate last owner
    log('PUT /:id/status - cannot deactivate last owner');
    const ownerDoc = await engine.models.Staff.findOne({ email: 'owner@test.com' });
    const lastOwnerRes = await req('PUT', `/${ownerDoc!._id}/status`, {
      status: 'inactive',
    }, ownerToken);
    if (lastOwnerRes.status === 400 && lastOwnerRes.data.code === 'STAFF_LAST_OWNER_GUARD') {
      pass('Last owner guard working');
    } else {
      fail('Should have been rejected', lastOwnerRes.data);
    }

    // 19. Reset password
    log('PUT /:staffId/password - reset staff password');
    const resetRes = await req('PUT', `/${staffId}/password`, {
      password: 'newpassword123',
    }, ownerToken);
    if (resetRes.status === 200) {
      pass('Password reset');
    } else {
      fail('Password reset failed', resetRes.data);
    }

    console.log('\n========================================');
    console.log('  ALL INTEGRATION TESTS PASSED');
    console.log('========================================\n');

  } catch (error) {
    console.error('\nUnexpected error:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup
    log('Cleaning up');
    await connection.dropDatabase();
    await connection.close();
    server.close();
    await engine.destroy();
    pass('Cleanup complete');
  }
}

main().catch(console.error);
