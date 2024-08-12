import { GoogleAuth } from "google-auth-library";

const { VertexAI } = require("@google-cloud/vertexai");

// Assuming you have the base64 encoded service account key stored in SERVICE_ACCOUNT_KEY_BASE64 environment variable
const encodedKey = process.env.SERVICE_ACCOUNT_KEY_BASE64;
if (!encodedKey) {
  throw new Error(
    "SERVICE_ACCOUNT_KEY_BASE64 environment variable is missing."
  );
}

// Decode the base64 encoded key
const decodedKey = Buffer.from(encodedKey, "base64").toString("utf-8");

// Parse the decoded key into a JavaScript object
const serviceAccountKey = JSON.parse(decodedKey);

// Create a new GoogleAuth instance and specify the target scopes
const auth = new GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

// Get the client object
const client = await auth.getClient();

// Initialize Vertex with your Cloud project and location
const vertex_ai = new VertexAI({
  project: "eminent-will-432005-a5",
  location: "us-central1",
  client,
});

// Model currently in use
const model = "gemini-1.5-flash-001";

// Inform the AI what should it focus on when trying to give answers to users.
const textsi_1 = {
  text: `I am developing a customer support chatbot for Headstarter AI, a platform specialized in conducting AI-powered interviews for Software Engineering positions. The bot should be capable of handling a wide range of queries including but not limited to scheduling interviews, explaining AI features, addressing technical issues, and providing resources for interview preparation. Please generate a series of conversational responses that reflect a knowledgeable and helpful demeanor. Each response should be tailored to address common inquiries and effectively guide users towards resolving their issues or finding the information they seek. Don't answer question that are out of context and stick to what you are told to do.\"

  This prompt sets the stage for the GPT model by specifying the context (a customer support bot for Headstarter AI), the domain (AI-powered interviews for SWE jobs), and the types of interactions the bot should be capable of managing. It also emphasizes the importance of the bot\'s demeanor—knowledgeable and helpful—and its role in guiding users effectively.`,
};

// Instantiate the models
const generativeModel = vertex_ai.preview.getGenerativeModel({
  model: model,
  generationConfig: {
    maxOutputTokens: 8192,
    temperature: 1,
    topP: 0.95,
  },
  safetySettings: [
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
  ],
  systemInstruction: {
    parts: [textsi_1],
  },
});

export async function POST(req) {
  // Assuming the request body contains the initial user message
  const contents = await req.json();

  console.log("contents:", contents);

  // Find the last user message
  const lastUserMessage = contents
    .reverse()
    .find((item) => item.role === "user");

  if (!lastUserMessage) {
    return new Response("No user message found", { status: 400 });
  }

  const reqBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: lastUserMessage.content }],
      },
    ],
  };

  const streamingResp = await generativeModel.generateContentStream(reqBody);

  // Create a new ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      for await (const item of streamingResp.stream) {
        const chunk = item.candidates[0].content.parts[0].text;
        // Encode the chunk and enqueue it
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

  // Return a streaming response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
