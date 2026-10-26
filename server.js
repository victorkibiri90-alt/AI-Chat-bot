import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const SECRET = "pentagon_pro_2026";
// MEMORY DB FOR VERCEL - replaces sqlite3
let users = [];
let chats = [];
const db = {
  run: (sql, params, cb) => { if(cb) cb(null); },
  get: (sql, params, cb) => { if(cb) cb(null, null); },
  all: (sql, params, cb) => { if(cb) cb(null, []); },
  serialize: (fn) => { if(fn) fn(); }
};
console.log("Using memory database for Vercel - no sqlite3");

function optionalAuth(req,res,next){
  const t=req.headers.authorization;
  if(!t){next();return;}
  try{ req.userId = jwt.verify(t,SECRET).id; }catch{}
  next();
}

const API_KEY = process.env.GEMINI_API_KEY;
console.log("API Key:", API_KEY ? "YES loaded" : "NO - check .env");

app.post('/api/login', async (req,res)=>{
  const {username,password}=req.body;
  const user = users.find(u=>u.username===username);
  if(!user) return res.status(400).json({error:"User not found"});
  const ok = await bcrypt.compare(password, user.password);
  if(!ok) return res.status(400).json({error:"Wrong password"});
  const token=jwt.sign({id:user.id},SECRET,{expiresIn:'30d'});
  res.json({token,username});
});

app.post('/api/login', async (req,res)=>{
  const {username,password}=req.body;
  const user = users.find(u=>u.username===username);
  if(!user) return res.status(400).json({error:"User not found"});
  const ok = await bcrypt.compare(password, user.password);
  if(!ok) return res.status(400).json({error:"Wrong password"});
  const token=jwt.sign({id:user.id},SECRET,{expiresIn:'30d'});
  res.json({token,username});
});


app.get('/api/history', (req,res)=>{
  const t=req.headers.authorization;
  if(!t) return res.json([]);
  try{
    const {id}=jwt.verify(t,SECRET);
    db.all(`SELECT role,message FROM chats WHERE userId=? ORDER BY timestamp ASC`,[id],(err,rows)=>{res.json(rows);});
  }catch{res.json([]);}
});

app.post('/api/chat', optionalAuth, async (req, res) => {
  try {
    const userMessage = String(req.body.message || "");
    const fileData = req.body.image;
    const mimeType = req.body.mimeType;

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        reply: "PENTAGON AI is not configured yet."
      });
    }

    const systemPrompt = `
You are PENTAGON AI, an intelligent general-purpose AI assistant.

IDENTITY:
- Your name is PENTAGON AI.
- Introduce yourself as PENTAGON AI.
- Do not present yourself as Groq, ChatGPT, or Gemini.
- If asked about your underlying AI model or provider,
  answer truthfully.
- Do not invent details about your creators.

PERSONALITY:
- Be adaptive, intelligent, warm, and approachable.
- Adjust your tone to the user's situation.
- Use emojis naturally when appropriate, not excessively.
- Be professional for serious or technical questions.
- Be empathetic and respectful in emotional conversations.
- Be concise for simple questions and detailed when needed.
- Ask clarifying questions only when necessary.

INTELLIGENCE:
- Prioritize accuracy and clear reasoning.
- Never fabricate facts, sources, or capabilities.
- Admit uncertainty when appropriate.
- Explain complex topics clearly.
- Help with education, coding, writing, analysis,
  brainstorming, and everyday questions.
- Do not claim to have searched the internet unless
  an actual search tool was used.
`;

    let model = "openai/gpt-oss-120b";
    let content = userMessage;

    if (fileData && mimeType) {
      if (typeof fileData !== "string") {
        return res.status(400).json({
          reply: "Invalid attachment."
        });
      }

      const base64 = fileData.includes(",")
        ? fileData.split(",")[1]
        : fileData;

      const buffer = Buffer.from(base64, "base64");

      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(413).json({
          reply: "File too large. Please upload a file under 10 MB."
        });
      }

      if (mimeType === "image/jpeg" ||
          mimeType === "image/png") {

        model = "qwen/qwen3.8-27b";

        content = [
          {
            type: "text",
            text: userMessage ||
              "Please analyze this image."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`
            }
          }
        ];

      } else if (mimeType === "application/pdf") {

        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({
          data: new Uint8Array(buffer)
        });

        let extractedText;

        try {
          const result = await parser.getText();
          extractedText = result.text;
        } finally {
          await parser.destroy();
        }

        if (!extractedText?.trim()) {
          return res.json({
            reply: "I couldn't extract readable text from this PDF. It may be scanned or image-based."
          });
        }

        content = `
User question:
${userMessage || "Analyze this document."}

PDF document content:
${extractedText.slice(0, 30000)}
`;

      } else if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {

        const mammoth = await import("mammoth");

        const result = await mammoth.extractRawText({
          buffer
        });

        if (!result.value?.trim()) {
          return res.json({
            reply: "I couldn't extract readable text from this Word document."
          });
        }

        content = `
User question:
${userMessage || "Analyze this document."}

Word document content:
${result.value.slice(0, 30000)}
`;

      } else {
        return res.status(400).json({
          reply: "Unsupported file type. Please upload JPG, PNG, PDF, or DOCX."
        });
      }
    }

    if (!fileData && !userMessage.trim()) {
      return res.status(400).json({
        reply: "Please enter a message."
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      25000
    );

    let response;

    try {
      response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content
              }
            ],
            max_completion_tokens: 2048
          }),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json();

    console.log("Groq status:", response.status);

    if (!response.ok) {
      console.error(
        "Groq API error:",
        response.status,
        data.error?.message
      );

      const message =
        response.status === 429
          ? "I'm receiving too many requests right now. Please try again shortly."
          : response.status === 401
          ? "PENTAGON AI has an API authentication problem."
          : data.error?.message ||
            "The AI service is temporarily unavailable.";

      return res.status(response.status).json({
        reply: message
      });
    }

    const botReply =
      data.choices?.[0]?.message?.content ||
      "I couldn't generate a response. Please try again.";

    if (req.userId) {
      db.run(
        `INSERT INTO chats (userId,role,message) VALUES (?,?,?)`,
        [req.userId, "user", userMessage]
      );

      db.run(
        `INSERT INTO chats (userId,role,message) VALUES (?,?,?)`,
        [req.userId, "bot", botReply]
      );
    }

    return res.json({ reply: botReply });

  } catch (error) {
    console.error("PENTAGON AI error:", error);

    return res.status(500).json({
      reply:
        error.name === "AbortError"
          ? "The AI request took too long. Please try again."
          : "Something went wrong while processing your request."
    });
  }
});

app.delete('/api/clear', (req,res)=>{
  const t=req.headers.authorization;
  if(!t) return res.json({success:true});
  try{
    const {id}=jwt.verify(t,SECRET);
    db.run(`DELETE FROM chats WHERE userId=?`,[id], ()=> res.json({success:true}));
  }catch{res.json({success:true});}
});

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'index.html')));
export default app;