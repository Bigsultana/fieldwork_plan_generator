export function workspaceElement(tag, className = "", text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function workspaceButton(text, action, title = text) {
  const element = workspaceElement("button", "button secondary", text);
  element.type = "button";
  element.title = title;
  element.addEventListener("click", action);
  return element;
}

export function workspaceMenu(label, { closeOnAction = true } = {}) {
  const details = workspaceElement("details", "workspace-command");
  const summary = workspaceElement("summary", "button secondary", label);
  const content = workspaceElement("div", "workspace-command-menu");
  details.append(summary, content);
  document.addEventListener("click", (event) => { if (!details.contains(event.target)) details.open = false; });
  details.addEventListener("keydown", (event) => { if (event.key === "Escape") { details.open = false; summary.focus(); } });
  if (closeOnAction) content.addEventListener("click", (event) => { if (event.target.closest("button")) details.open = false; });
  return { element: details, content };
}

export function workspaceDialog(title, parent) {
  const dialog = workspaceElement("dialog", "workspace-dialog");
  dialog.setAttribute("aria-label", title);
  const heading = workspaceElement("div", "workspace-dialog-heading");
  heading.append(workspaceElement("h2", "", title), workspaceButton("Close", () => dialog.close()));
  const content = workspaceElement("div", "workspace-dialog-content");
  dialog.append(heading, content);
  parent.append(dialog);
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  return { element: dialog, content, open: () => dialog.showModal() };
}
