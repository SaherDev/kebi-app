const KEY = 'kebi-app.tasteProfile';

export function getTasteProfileConfirmed(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTasteProfileConfirmed(): void {
  try {
    localStorage.setItem(KEY, 'true');
  } catch {
    // localStorage unavailable — no-op
  }
}

export function clearTasteProfileConfirmed(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // localStorage unavailable — no-op
  }
}
