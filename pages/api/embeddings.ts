import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req: any, res: any) {
  let text: string[] = req.body.text;
  const response = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: text.map((item) => {
      if (item.length > 1000) {
        return item.slice(0, 500) + "\n\n...\n\n" + item.slice(-500);
      } else {
        return item;
      }
    }),
  });

  if (response.status === 200) {
    res.status(200).json(response.data.data.map((item) => item.embedding));
  } else {
    throw new Error("OpenAI returned " + response.status);
  }
}
