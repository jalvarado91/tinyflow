import { MongoClient } from "mongodb";
import { env } from "~/env";

const connectionString = env.MONGO_CONNECTION_STRING;

const dbName = "TinyFlow";

export async function createDbConnection() {
  const client = new MongoClient(connectionString);
  await client.connect();
  const db = client.db(dbName);
  return db;
}
