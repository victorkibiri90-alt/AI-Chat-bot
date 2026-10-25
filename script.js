let lastUploadedImage = null;
let lastMimeType = null;
let lastFileName = null;

const ChatBox = document.getElementById("chat-box")
const UserInput = document.getElementById("user-input")
const SendBtn = document.getElementById("send-button")

// === FIXED LOGIN UI - INSIDE LEFT MENU ===
function updateLoginUI() {
  const currentUser = localStorage.getItem("currentUser");
  const menuBtn = document.getElementById("menuAuthBtn");
  if (!menuBtn) return;
  if (currentUser) {
    menuBtn.textContent = "Logout (" + currentUser + ")";
  } else {
    menuBtn.textContent = "Login";
  }
}

function doLogout() {
  if (confirm("Logout?")) {
    localStorage.removeItem("currentUser");
    updateLoginUI();
    location.reload();
  }
}

function handleMenuAuth() {
  const u = localStorage.getItem("currentUser");
  if (u) {
    doLogout();
  } else {
    openAuth();
  }
  toggleMenu();
}

// === MENU ===
function toggleMenu(){
  const m = document.getElementById('sideMenu');
  const o = document.getElementById('menuOverlay');
  if(!m) return;
  m.classList.toggle('open');
  if(o) o.classList.toggle('show');
}
function newChat(){ if(ChatBox) ChatBox.innerHTML=''; localStorage.removeItem("ChatHistory_" + (localStorage.getItem("currentUser") || "guest")); }
function clearChat(){ if(confirm('Clear chat?')){ if(ChatBox) ChatBox.innerHTML=''; } }
function showSettings(){ alert('Settings coming'); }

function addMessage(message, className, imageSrc = null) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", className);
    if(imageSrc){
      if(lastMimeType && lastMimeType.startsWith('image/')){
        const img = document.createElement("img");
        img.src = imageSrc;
        img.style.maxWidth = "200px";
        img.style.borderRadius = "12px";
        img.style.display = "block";
        img.style.marginBottom = "6px";
        msgDiv.appendChild(img);
      } else {
        const fileCard = document.createElement("div");
        fileCard.style.background = "rgba(212,175,55,0.15)";
        fileCard.style.padding = "8px 12px";
        fileCard.style.borderRadius = "10px";
        fileCard.style.marginBottom = "6px";
        fileCard.style.display = "flex";
        fileCard.style.alignItems = "center";
        fileCard.style.gap = "8px";
        fileCard.innerHTML = `📄 <strong>${lastFileName || 'Document'}</strong>`;
        msgDiv.appendChild(fileCard);
      }
    }
    const textSpan = document.createElement("span");
    textSpan.textContent = message;
    msgDiv.appendChild(textSpan);
    ChatBox.appendChild(msgDiv)
    ChatBox.scrollTop = ChatBox.scrollHeight
}

function showTyping() {
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("message", "bot-message");
    typingDiv.id = "typing-indicator";
    typingDiv.innerHTML = `<span class="dot">.</span><span class="dot">.</span>`;
    ChatBox.appendChild(typingDiv);
    ChatBox.scrollTop = ChatBox.scrollHeight;
    return typingDiv;
}

async function getBotReply(usermessage) {
    try {
        const response = await fetch('http://127.0.0.1:3000/api/chat', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: usermessage, image: lastUploadedImage, mimeType: lastMimeType }),
        });
        const data = await response.json();
        return data.reply;
    } catch (error) {
        return "Error: Server not running. Run node server.js";
    }
}

SendBtn.onclick = async () => {
    const message = UserInput.value.trim()
    if (message === "" && !lastUploadedImage) return;
    let imgSrcForChat = null;
    if(lastUploadedImage){ imgSrcForChat = `data:${lastMimeType};base64,${lastUploadedImage}`; }
    addMessage(message, "user-message", imgSrcForChat)
    document.getElementById('preview-area').style.display = 'none';
    UserInput.value = ""
    const typingDiv = showTyping()
    const botreply = await getBotReply(message);
    lastUploadedImage = null; lastMimeType = null; lastFileName = null;
    typingDiv.remove()
    const botDiv = document.createElement('div');
    botDiv.className = 'message bot-message';
    botDiv.textContent = botreply;
    ChatBox.appendChild(botDiv);
    ChatBox.scrollTop = ChatBox.scrollHeight;
    const u = localStorage.getItem("currentUser") || "guest";
    localStorage.setItem("ChatHistory_" + u, ChatBox.innerHTML);
    saveToHistoryList();
}

UserInput.addEventListener("keypress", (e) => { if (e.key=== "Enter") SendBtn.click() })

// AUTH MODAL
let isLoginMode = true;
function openAuth() { const modal = document.getElementById('authModal'); if (modal) modal.style.display = 'flex'; }
function closeAuth() { const modal = document.getElementById('authModal'); if (modal) modal.style.display = 'none'; }
function toggleMode() {
  isLoginMode = !isLoginMode;
  const modalTitle = document.querySelector("#authModal h2");
  const btn = document.querySelector("#authModal button");
  const toggleText = document.querySelector("p[onclick*='toggleMode']");
  if (modalTitle) modalTitle.textContent = isLoginMode ? "Login" : "Register";
  if (btn) btn.textContent = isLoginMode ? "GO" : "Create Account";
  if (toggleText) toggleText.textContent = isLoginMode ? "No account? Register" : "Have account? Login";
}
function doAuth() {
  const userEl = document.querySelector("input[placeholder*='Username'], #authModal input[type='text']");
  const passEl = document.querySelector("input[placeholder*='Password'], #authModal input[type='password']");
  const username = userEl?.value?.trim();
  const password = passEl?.value?.trim();
  if (!username || !password) { alert("Enter username and password"); return; }
  const key = "pentagon_user_" + username;
  const savedPass = localStorage.getItem(key);
  if (!isLoginMode) {
    if (savedPass) { alert("Account exists! Login instead."); toggleMode(); return; }  
    localStorage.setItem(key, password);
    alert("Account created! Now login.");
    toggleMode();
  } else {
    if (!savedPass) { alert("No account for '" + username + "'. Register first."); return; }
    if (savedPass !== password) { alert("Wrong password"); return; }
    localStorage.setItem("currentUser", username);
    closeAuth();
    updateLoginUI();
    alert("Welcome " + username + "!");
  }
}

// START
document.addEventListener('DOMContentLoaded', () => {
  updateLoginUI();
  const saved = localStorage.getItem("ChatHistory_" + (localStorage.getItem("currentUser") || "guest"));
  if(saved && ChatBox){ ChatBox.innerHTML = saved; }
  ensureHistoryModal();
});

// ===============================
// === HISTORY PART - ONLY ADDED ===
// ===============================
function ensureHistoryModal(){
  if(document.getElementById('historyModal')) return;
  const div = document.createElement('div');
  div.id = 'historyModal';
  div.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:9999; align-items:center; justify-content:center;';
  div.innerHTML = `
    <div style="background:#1a1a1a; border:1px solid #d4af37; border-radius:12px; width:90%; max-width:400px; max-height:70vh; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px; border-bottom:1px solid #333;">
        <h3 style="color:#d4af37; margin:0;">History</h3>
        <button onclick="closeHistory()" style="background:transparent; border:none; color:#fff; font-size:22px; cursor:pointer;">×</button>
      </div>
      <div id="historyList" style="overflow-y:auto; padding:8px; flex:1;"></div>
      <button onclick="clearAllHistory()" style="background:#222; color:#ff5555; border:none; padding:10px; margin:10px; border-radius:6px; cursor:pointer;">Clear All History</button>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener('click', (e)=>{ if(e.target.id==='historyModal') closeHistory(); });
}

function saveToHistoryList(){
  const user = localStorage.getItem("currentUser") || "guest";
  const html = ChatBox.innerHTML;
  if(!html || html.length < 20) return;
  const temp = document.createElement('div'); temp.innerHTML = html;
  const firstUserMsg = temp.querySelector('.user-message')?.textContent?.slice(0,35) || 'New Chat';
  let list = JSON.parse(localStorage.getItem('pentagon_all_history_' + user) || '[]');
  list = list.filter(c => c.html !== html);
  list.unshift({ id: Date.now(), title: firstUserMsg, html: html, date: new Date().toLocaleString() });
  list = list.slice(0, 30);
  localStorage.setItem('pentagon_all_history_' + user, JSON.stringify(list));
}

function showHistory(){
  ensureHistoryModal();
  const user = localStorage.getItem("currentUser") || "guest";
  const list = JSON.parse(localStorage.getItem('pentagon_all_history_' + user) || '[]');
  const container = document.getElementById('historyList');
  if(list.length === 0){
    container.innerHTML = `<p style="color:#777; text-align:center; padding:20px;">No history yet. Chat something!</p>`;
  } else {
    container.innerHTML = list.map((item, idx) => `
      <div onclick="loadHistory(${idx})" style="padding:12px; border-bottom:1px solid #222; cursor:pointer;">
        <div style="color:#d4af37; font-weight:bold; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</div>
        <div style="color:#666; font-size:11px;">${item.date}</div>
      </div>
    `).join('');
  }
  document.getElementById('historyModal').style.display = 'flex';
  toggleMenu();
}

function closeHistory(){ const m=document.getElementById('historyModal'); if(m) m.style.display='none'; }
function loadHistory(index){
  const user = localStorage.getItem("currentUser") || "guest";
  const list = JSON.parse(localStorage.getItem('pentagon_all_history_' + user) || '[]');
  const item = list[index];
  if(!item) return;
  ChatBox.innerHTML = item.html;
  localStorage.setItem("ChatHistory_" + user, item.html);
  closeHistory();
}
function clearAllHistory(){
  if(!confirm('Delete all history?')) return;
  const user = localStorage.getItem("currentUser") || "guest";
  localStorage.removeItem('pentagon_all_history_' + user);
  document.getElementById('historyList').innerHTML = `<p style="color:#777; text-align:center; padding:20px;">Cleared</p>`;
}

// === PLUS BUTTON FIX ===
const plusBtn = document.getElementById('plus-btn');
const plusMenu = document.getElementById('plus-menu');
const previewArea = document.getElementById('preview-area');
const previewImg = document.getElementById('preview-img');
const removePreview = document.getElementById('remove-preview');
const camInput = document.getElementById('camera-input');
const galInput = document.getElementById('gallery-input');
const fileInput = document.getElementById('file-input');

if (plusBtn && plusMenu) {
  plusBtn.onclick = (e) => {
    e.stopPropagation();
    plusMenu.style.display = plusMenu.style.display === 'block' ? 'none' : 'block';
  };
  document.addEventListener('click', () => { if(plusMenu) plusMenu.style.display = 'none'; });
}

function openFilePicker(input){
  if(input) { input.click(); if(plusMenu) plusMenu.style.display='none'; }
}

const optCam = document.getElementById('opt-camera');
const optGal = document.getElementById('opt-gallery');
const optFile = document.getElementById('opt-file');

if(optCam) optCam.onclick = () => openFilePicker(camInput);
if(optGal) optGal.onclick = () => openFilePicker(galInput);
if(optFile) optFile.onclick = () => openFilePicker(fileInput);

function handlePickedFile(file){
  if(!file) return;
  lastFileName = file.name;
  lastMimeType = file.type;
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target.result;
    const base64 = result.split(',')[1] || result;
    lastUploadedImage = base64;
    if(previewImg && result.startsWith('data:image')){
      previewImg.src = result;
    } else if(previewImg){
      previewImg.src = '';
    }
    const nameEl = document.getElementById('preview-name');
    if(nameEl) nameEl.textContent = file.name;
    if(previewArea) previewArea.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

if(camInput) camInput.onchange = (e) => handlePickedFile(e.target.files[0]);
if(galInput) galInput.onchange = (e) => handlePickedFile(e.target.files[0]);
if(fileInput) fileInput.onchange = (e) => handlePickedFile(e.target.files[0]);

if(removePreview){
  removePreview.onclick = () => {
    lastUploadedImage = null;
    lastMimeType = null;
    lastFileName = null;
    if(previewArea) previewArea.style.display = 'none';
    if(camInput) camInput.value = '';
    if(galInput) galInput.value = '';
    if(fileInput) fileInput.value = '';
  };
}

// === PENTAGON NO-ECHO EVER ===
let lastUserTime = 0;
let lastUserText = "";

const micBtn = document.getElementById('mic-btn');
const inputBox = document.getElementById('user-input');
const sendBtn = document.getElementById('send-button');

function speakBot(text){
  if(Date.now() - lastUserTime < 2500) {
    console.log("BLOCKED echo - user just spoke");
    return;
  }
  if(text === lastUserText) return;
  if(!text || text.length < 2) return;
  
  speechSynthesis.cancel();
  let clean = text.replace(/<[^>]*>/g,'').replace(/```[\s\S]*?```/g,'').slice(0,400);
  let u = new SpeechSynthesisUtterance(clean);
  u.lang='en-US'; u.rate=0.95;
  console.log("🔊 SPEAKING BOT:", clean.substring(0,40));
  speechSynthesis.speak(u);
}

let rec, listening=false;
if(window.SpeechRecognition || window.webkitSpeechRecognition){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  rec = new SR(); rec.lang='en-US';
  rec.onstart = ()=>{ listening=true; micBtn.style.background='gold'; };
  rec.onend = ()=>{ listening=false; micBtn.style.background='#1a1a1a'; };
  rec.onresult = (e)=>{
    lastUserTime = Date.now();
    lastUserText = e.results[0][0].transcript;
    console.log("User said:", lastUserText);
    inputBox.value = lastUserText;
    sendBtn.click();
  };
}
micBtn.onclick = ()=>{ listening ? rec.stop() : rec.start(); };

const oldAdd = window.addMessage;
window.addMessage = function(text, sender, imageSrc){
  oldAdd(text, sender, imageSrc);
  console.log("MSG:", sender, text.substring(0,30));
  
  let lowerSender = (sender||"").toLowerCase();
  if(lowerSender.includes('user') || lowerSender.includes('you') || lowerSender.includes('human') || text === lastUserText){
    lastUserTime = Date.now();
    lastUserText = text;
    console.log("Marked as USER, will block echo for 2.5s");
    return;
  }
  setTimeout(()=>speakBot(text), 300);
};

console.log("✅ NO ECHO SYSTEM LOADED");