import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const name = process.argv[2] || "pilot-assistance";

const vs = await client.vectorStores.create({ name });

console.log("VECTOR_STORE_ID =", vs.id);
