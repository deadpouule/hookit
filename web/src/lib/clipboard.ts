export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text || typeof document === "undefined") return false;

  try {
    if (document.hasFocus() && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API throws when the tab is unfocused (Next overlay, iframe, etc.).
  }

  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  } catch {
    return false;
  }
}
