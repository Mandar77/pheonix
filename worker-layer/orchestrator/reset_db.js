import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const client = new MongoClient(process.env.MONGODB_URI);

async function clear() {
  await client.connect();
  await client.db('phoenix').collection('tasks').deleteMany({});
  await client.db('phoenix').collection('workflows').deleteMany({});
  console.log("💥 Database Wiped Clean. Ready for fresh test.");
  await client.close();
}
clear();