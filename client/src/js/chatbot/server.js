import OpenAI from "openai";
import express from "express";
import cors from "cors";

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: 'YOUR_API_KEY' });

app.post("/ask", async (req, res) => {
  try {
    const userInput = req.body.input;

    const response = await openai.chat.completions.create({
      model: "gpt-4.0", // use 'gpt-4' or 'gpt-3.5-turbo'
      messages: [{ role: "user", content: userInput }],
    });

    res.json({ response: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
