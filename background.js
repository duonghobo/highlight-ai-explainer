// Service worker: calls the Gemini API with the user's API key.

// "gemini-flash-latest" always points to the current stable Flash model,
// so the extension won't break when Google retires old model versions.
const MODEL = "gemini-flash-latest";
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  MODEL +
  ":generateContent";

const SYSTEM_PROMPT =
  "You are a concise explainer. The user sends a text snippet they highlighted on a web page. " +
  "Explain its meaning clearly in 2-4 short sentences. If it is a single term, define it. " +
  "If it is a passage, summarize the key point. Plain text only, no markdown.";

async function getApiKey() {
  const { geminiApiKey } = await chrome.storage.sync.get("geminiApiKey");
  return geminiApiKey || "";
}

async function explain(text) {
  const key = await getApiKey();
  if (!key) throw new Error("NO_KEY");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                'Explain the meaning of this highlighted text:\n\n"' +
                text.slice(0, 8000) +
                '"'
            }
          ]
        }
      ],
      generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
    })
  });

  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error?.message || "";
    } catch (_) {}
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error("BAD_KEY:" + detail);
    }
    if (res.status === 429) {
      throw new Error("Rate limit reached — wait a moment and try again.");
    }
    throw new Error("Gemini API error " + res.status + ": " + detail);
  }

  const data = await res.json();
  const answer = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();
  if (!answer) throw new Error("Empty response from Gemini.");
  return answer;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "EXPLAIN") return;

  (async () => {
    try {
      const answer = await explain(msg.text);
      sendResponse({ ok: true, answer });
    } catch (e) {
      const m = e?.message || String(e);
      if (m === "NO_KEY") {
        sendResponse({
          ok: false,
          error:
            "No API key set. Right-click the extension icon → Options, and paste your free Gemini API key from aistudio.google.com."
        });
      } else if (m.startsWith("BAD_KEY:")) {
        sendResponse({
          ok: false,
          error:
            "API key rejected. Check it in the extension Options. " +
            m.slice(8)
        });
      } else {
        sendResponse({ ok: false, error: m });
      }
    }
  })();

  return true; // keep channel open for async response
});
