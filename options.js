const keyInput = document.getElementById("key");
const status = document.getElementById("status");

chrome.storage.sync.get("geminiApiKey", ({ geminiApiKey }) => {
  if (geminiApiKey) keyInput.value = geminiApiKey;
});

document.getElementById("save").addEventListener("click", () => {
  const key = keyInput.value.trim();
  chrome.storage.sync.set({ geminiApiKey: key }, () => {
    status.textContent = "Saved ✓";
    setTimeout(() => (status.textContent = ""), 2000);
  });
});
