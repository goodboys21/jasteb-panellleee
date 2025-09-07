import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const DATABASE_URL = "https://jsonblob.com/api/jsonBlob/1413877719128793088";
const TELEGRAM_TOKEN = "7964560249:AAF78QqL2JveR3LvAqkS42c35WSMljAQqa4";
const TELEGRAM_CHAT_ID = "7081489041";

// === SEND EMAIL NOTIF ===
async function sendEmailNotif(type, email) {
  try {
    let url = "";
    if (type === "add") {
      url = `https://sendmail-lime.vercel.app/add?to=${encodeURIComponent(email)}`;
    } else if (type === "del") {
      url = `https://sendmail-lime.vercel.app/del?to=${encodeURIComponent(email)}`;
    }
    if (url) await fetch(url);
  } catch (e) {
    console.error("Send email notif failed:", e);
  }
}

// === SEND TELEGRAM NOTIF ===
async function sendTelegramNotif(action, email, ip, total) {
  const text = `🌀 CG Panel Notification 🌀

Action: ${action}
IP: ${ip || "N/A"}
Email: ${email}
Total Email: ${total}`;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
  } catch (e) {
    console.error("Send telegram notif failed:", e);
  }
}

// === Helper fetch database ===
async function getDatabase() {
  const res = await fetch(DATABASE_URL);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function saveDatabase(data) {
  await fetch(DATABASE_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// === Routes ===

// Get all emails
app.get("/api/email", async (req, res) => {
  try {
    const data = await getDatabase();
    res.json(data);
  } catch {
    res.status(500).json({ error: "Failed to load emails" });
  }
});

// Add new email
app.post("/api/email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const db = await getDatabase();
    if (db.some(e => e.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const ipRes = await fetch("https://api.ipify.org?format=json");
    const ipData = await ipRes.json();
    const ip = ipData.ip;

    const newEntry = { email, addedAt: new Date().toISOString(), ip };
    const updated = [...db, newEntry];
    await saveDatabase(updated);

    await sendTelegramNotif("Add", email, ip, updated.length);
    await sendEmailNotif("add", email);

    res.json({ success: true, data: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to add email" });
  }
});

// Delete email by index
app.delete("/api/email/:index", async (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    const db = await getDatabase();
    if (idx < 0 || idx >= db.length) {
      return res.status(400).json({ error: "Invalid index" });
    }

    const removed = db[idx];
    db.splice(idx, 1);
    await saveDatabase(db);

    await sendTelegramNotif("Delete", removed.email, removed.ip, db.length);
    await sendEmailNotif("del", removed.email);

    res.json({ success: true, data: db });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete email" });
  }
});

export default app;
