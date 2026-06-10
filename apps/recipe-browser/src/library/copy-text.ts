/** Synchronous fallback — works on static hosts where async clipboard API is blocked. */
function copyWithExecCommand(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:2em",
    "height:2em",
    "padding:0",
    "border:none",
    "outline:none",
    "box-shadow:none",
    "background:transparent",
  ].join(";");
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return ok;
}

/** Copy to clipboard; feedback (message/toast) is the caller's responsibility. */
export async function copyText(text: string): Promise<boolean> {
  if (copyWithExecCommand(text)) return true;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }

  return false;
}
