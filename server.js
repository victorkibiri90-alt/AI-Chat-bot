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

app.post('/api/chat', optionalAuth, async (req,res)=>{
  try{
    const userMessage = req.body.message || "";
    const fileData = req.body.image;
    const mimeType = req.body.mimeType;
    
    console.log("User:", userMessage, fileData ? `+ file ${mimeType}` : "");

    if(req.userId) db.run(`INSERT INTO chats (userId,role,message) VALUES (?,?,?)`,[req.userId,'user',userMessage]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // === ONLY ADDITION: BUILD PARTS FOR IMAGE/DOCUMENT ===
    let parts = [];
    if(fileData && mimeType){
      // FIXED: Remove data: prefix so Google accepts it
      const cleanBase64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: cleanBase64
        }
      });
      parts.push({ text: userMessage || `Analyze this ${mimeType.startsWith('image/') ? 'image' : 'document'}. Give detailed details.` });
    } else {
      parts.push({ text: userMessage });
    }

    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: parts }] }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (netError) {
      clearTimeout(timeoutId);
      console.error("Connection failed due to slow network or timeout:", netError);
      return res.json({ reply: "Network error: Connection timed out. Please check your Wi-Fi and try again." });
    }

    const data = await r.json();
    console.log("Google status:", r.status);
    
    if(data.error){
      return res.json({reply: data.error.message});
    }

    const botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hi, I am PENTAGON BOT";
    if(req.userId) db.run(`INSERT INTO chats (userId,role,message) VALUES (?,?,?)`,[req.userId,'bot',botReply]);
    res.json({reply: botReply});
  }catch(e){
    console.log("Server Error:", e);
    res.json({reply: "Error: " + e.message});
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