document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const command = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(command);
      button.classList.add("is-copied");
      button.setAttribute("aria-label", "Copied " + command);
      window.setTimeout(() => {
        button.classList.remove("is-copied");
        button.setAttribute("aria-label", "Copy " + command);
      }, 1200);
    } catch (error) {
      button.setAttribute("aria-label", "Could not copy " + command);
    }
  });
});

// Packet Tracer workbench tab switcher
const tabs = document.querySelectorAll(".pt-tab");
const tabPanels = document.querySelectorAll(".tab-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    tabPanels.forEach((panel) => {
      const matches = panel.id === `tab-${target}`;
      panel.hidden = !matches;
      panel.classList.toggle("is-active", matches);
    });
  });
});

// Safely highlight common Cisco IOS lines without injecting raw HTML from untrusted strings
function renderHighlightedOutput(preElement, rawText) {
  const text = rawText || "(No output returned.)";
  const lines = text.split(/\r?\n/);

  lines.forEach((line) => {
    const lineSpan = document.createElement("span");
    lineSpan.className = "term-line";

    const trimmed = line.trim();
    const isError =
      trimmed.startsWith("%") ||
      trimmed === "^" ||
      /invalid input|incomplete command|ambiguous command/i.test(line);
    const isDown =
      /\badministratively down\b/i.test(line) ||
      /\bdown\b/i.test(line);
    const isUp =
      /\bup\b/i.test(line) && !isDown;
    const isHeader =
      /^(Cisco IOS Software|System image file|hostname |interface |ip route |router )/i.test(trimmed);

    if (isError) {
      lineSpan.classList.add("tok-down");
    } else if (isDown) {
      lineSpan.classList.add("tok-warn");
    } else if (isUp) {
      lineSpan.classList.add("tok-up");
    } else if (isHeader) {
      lineSpan.classList.add("tok-key");
    }

    lineSpan.textContent = line || " ";
    preElement.append(lineSpan);
  });
}

const runForm = document.querySelector("#run-form");
const runButton = runForm.querySelector("button");
const runLabel = runForm.querySelector(".run-label");
const runStatus = document.querySelector("#run-status");
const connectionState = document.querySelector("#connection-state");
const runError = document.querySelector("#run-error");
const resultsSection = document.querySelector("#results");
const resultList = document.querySelector("#result-list");
const clearResultsButton = document.querySelector("#clear-results");

clearResultsButton?.addEventListener("click", () => {
  resultList.replaceChildren();
  resultsSection.hidden = true;
  runStatus.textContent = "Terminal output cleared.";
});

runForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  runButton.disabled = true;
  runLabel.textContent = "Connecting...";
  runStatus.textContent = "Connecting to the router and running commands.";
  if (connectionState) connectionState.textContent = "Connecting...";
  runError.hidden = true;
  resultsSection.hidden = true;
  resultList.replaceChildren();

  try {
    const response = await fetch(runForm.action, {
      method: "POST",
      headers: { "Accept": "application/json" }
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Flask did not return a command response. Start the app with `python api.py`, then open http://127.0.0.1:5000.");
    }
    const data = await response.json();

    for (const [command, output] of Object.entries(data.results || {})) {
      const card = document.createElement("article");
      card.className = "result-card";

      const heading = document.createElement("div");
      heading.className = "result-command";

      const promptLine = document.createElement("span");
      promptLine.className = "result-prompt-line";

      const hostSpan = document.createElement("span");
      hostSpan.className = "term-host";
      hostSpan.textContent = "Router#";

      const commandLabel = document.createElement("code");
      commandLabel.textContent = command;

      const cursorSpan = document.createElement("span");
      cursorSpan.className = "term-cursor";
      cursorSpan.setAttribute("aria-hidden", "true");

      promptLine.append(hostSpan, commandLabel, cursorSpan);

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "result-actions";

      const expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.className = "term-action";
      expandBtn.textContent = "Expand";

      const copyOutBtn = document.createElement("button");
      copyOutBtn.type = "button";
      copyOutBtn.className = "term-action";
      copyOutBtn.textContent = "Copy output";

      actionsDiv.append(expandBtn, copyOutBtn);
      heading.append(promptLine, actionsDiv);

      const bodyWrap = document.createElement("div");
      bodyWrap.className = "term-body-wrap";

      const outputText = document.createElement("pre");
      const rawOutput = output || "(No output returned.)";
      renderHighlightedOutput(outputText, rawOutput);

      expandBtn.addEventListener("click", () => {
        const expanded = outputText.classList.toggle("is-expanded");
        expandBtn.textContent = expanded ? "Collapse" : "Expand";
      });

      copyOutBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(rawOutput);
          copyOutBtn.textContent = "Copied";
          copyOutBtn.classList.add("is-copied");
          window.setTimeout(() => {
            copyOutBtn.textContent = "Copy output";
            copyOutBtn.classList.remove("is-copied");
          }, 1200);
        } catch {
          copyOutBtn.textContent = "Failed";
        }
      });

      bodyWrap.append(outputText);
      card.append(heading, bodyWrap);
      resultList.append(card);
    }

    if (!response.ok || data.error) {
      throw new Error(data.error || `Request failed (${response.status}).`);
    }

    resultsSection.hidden = false;
    runStatus.textContent = "Commands completed successfully.";
    if (connectionState) connectionState.textContent = "Session active";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runError.textContent = message.includes("Failed to fetch")
      ? "Could not reach the Flask server. Start the app with `python api.py`, then open http://127.0.0.1:5000."
      : message;
    runError.hidden = false;
    if (resultList.childElementCount > 0) {
      resultsSection.hidden = false;
    }
    runStatus.textContent = "The command run did not complete.";
    if (connectionState) connectionState.textContent = "Connection error";
  } finally {
    runButton.disabled = false;
    runLabel.textContent = "Run all commands";
  }
});