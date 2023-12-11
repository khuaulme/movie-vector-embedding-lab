const { MongoClient } = require("mongodb");
const axios = require("axios");

require("dotenv").config();
const uri = process.env.MONGODB_CONNECTION_STRING;

const client = new MongoClient(uri);
const hf_token = process.env.HF_ACCESS_TOKEN;

const embeddingUrl =
  "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2";

async function main() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged deployment. You successfully connected to your MongoDB Atlas cluster."
    );
  } finally {
    console.log("Closing connection.");
    await client.close();
  }
}

// main().catch(console.dir);

async function generateEmbeddings(text) {
  const data = { inputs: text };
  try {
    const response = await axios({
      url: embeddingUrl,
      method: "POST",
      headers: {
        Authorization: `Bearer ${hf_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: data,
    });
    if (response.status !== 200) {
      throw new Error(
        `Request failed with status code: ${response.status}: ${response.data}`
      );
    }
    // START JUST TO SEE IF EMBEDDINGS ARE RETURNED
    // console.log(response.data);

    // IF EMBEDDINGS WORK, UNCOMMENT THE FOLLOWING
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

// generateEmbeddings("Rajesh is in the HOUSE!!!");

// SAVE PLOT EMBEDDINGS to 50 MOVIES
async function saveEmbeddings() {
  try {
    await client.connect();

    const db = client.db("sample_mflix");
    const collection = db.collection("movies");

    const docs = await collection
      .find({ plot: { $exists: true }, genres: "Comedy" })
      .limit(100)
      .toArray();

    for (let doc of docs) {
      doc.plot_embedding_hf = await generateEmbeddings(doc.plot);
      await collection.replaceOne({ _id: doc._id }, doc);
      console.log(`Updated ${doc._id}`);
    }
  } finally {
    console.log("Closing connection.");
    await client.close();
  }
}

// saveEmbeddings();

async function queryEmbeddings(query) {
  try {
    await client.connect();

    const db = client.db("sample_mflix");
    const collection = db.collection("movies");

    results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: "vectorIndex",
            queryVector: await generateEmbeddings(query),
            path: "plot_embedding_hf",
            numCandidates: 100,
            limit: 8,
          },
        },
        {
          $project: {
            _id: 0,
            title: 1,
            plot: 1,
          },
        },
      ])
      .toArray();
    console.log(results);
  } finally {
    console.log("Closing connection.");
    await client.close();
  }
}

queryEmbeddings("friends in Las Vegas");
