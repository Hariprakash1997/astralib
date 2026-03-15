import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

export async function setup() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env['MONGOMS_TEST_URI'] = uri;
}

export async function teardown() {
  if (mongod) {
    await mongod.stop();
  }
}
