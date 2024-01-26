import { type Db, MongoClient } from "mongodb";
import { env } from "~/env";

const connectionString = env.MONGO_CONNECTION_STRING;

const dbName = "TinyFlow";
let cachedClient: Db;

export async function createDbConnection() {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(connectionString);
  await client.connect();
  const db = client.db(dbName);
  cachedClient = db;
  return cachedClient;
}
