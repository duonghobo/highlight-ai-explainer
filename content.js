// Content script: shows a floating card near the selection with the AI explanation.
// Sends the highlighted text to the background service worker (Gemini API).

(() => {
  const CARD_ID = "hae-popup-card";
  let currentCard = null;
  let requestSeq = 0;

  function removeCard() {
    if (currentCard) {
      currentCard.remove();
      currentCard = null;
    }
  }

  function createCard(rect) {
    removeCard();
    const card = document.createElement("div");
    card.id = CARD_ID;

    const margin = 8;
    const top =
      rect.bottom + 240 < window.innerHeight
        ? rect.bottom + margin + window.scrollY
        : Math.max(rect.top - 240, 10) + window.scrollY;
    const left = Math.min(
      Math.max(rect.left + window.scrollX, 10),
      window.scrollX + document.documentElement.clientWidth - 340
    );

    card.style.top = top + "px";
    card.style.left = left + "px";

    card.innerHTML =
      '<div class="hae-header">' +
      '<span class="hae-title">✨ AI Meaning</span>' +
      '<button class="hae-close" title="Close">×</button>' +
      "</div>" +
      '<div class="hae-body"><span class="hae-loading">Thinking…</span></div>';

    card.querySelector(".hae-close").addEventListener("click", removeCard);
    card.addEventListener("mousedown", (e) => e.stopPropagation());
    card.addEventListener("mouseup", (e) => e.stopPropagation());

    document.body.appendChild(card);
    currentCard = card;
    return card;
  }

  function setBody(card, text, isError) {
    if (!currentCard || card !== currentCard) return;
    const body = card.querySelector(".hae-body");
    body.textContent = text;
    body.classList.toggle("hae-error", !!isError);
  }

  function onSelection() {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (text.length < 3 || text.length > 8000) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;

    const card = createCard(rect);
    const seq = ++requestSeq;

    chrome.runtime.sendMessage({ type: "EXPLAIN", text }, (res) => {
      if (seq !== requestSeq) return;
      if (chrome.runtime.lastError) {
        setBody(card, "Extension error: " + chrome.runtime.lastError.message, true);
        return;
      }
      if (res && res.ok) setBody(card, res.answer, false);
      else setBody(card, (res && res.error) || "Unknown error.", true);
    });
  }

  document.addEventListener("mouseup", (e) => {
    if (currentCard && currentCard.contains(e.target)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!text) {
        removeCard();
        return;
      }
      onSelection();
    }, 10);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") removeCard();
  });
})();
