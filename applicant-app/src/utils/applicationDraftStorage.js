import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'application_wizard_drafts_v1';

// Drafts older than this are considered stale and discarded on read.
// Prevents submitting outdated income figures, co-maker lists, etc.
const DRAFT_TTL_DAYS = 30;
const DRAFT_TTL_MS = DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;

const parseStoredValue = (value) => {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const isDraftExpired = (draft) => {
  if (!draft?.updatedAt) return true;
  return Date.now() - new Date(draft.updatedAt).getTime() > DRAFT_TTL_MS;
};

const persistDraftMap = async (draftMap) => {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(draftMap));
};

export const getLoanTypeDraft = async (loanTypeId) => {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    const drafts = parseStoredValue(raw);
    const key = String(loanTypeId);
    const draft = drafts[key] || null;

    if (!draft) return null;

    // Evict expired draft so storage doesn't accumulate stale data
    if (isDraftExpired(draft)) {
      delete drafts[key];
      await persistDraftMap(drafts);
      return null;
    }

    return draft;
  } catch {
    return null;
  }
};

export const saveLoanTypeDraft = async (loanTypeId, patch) => {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  const drafts = parseStoredValue(raw);
  const key = String(loanTypeId);
  const existing = drafts[key] || {};

  drafts[key] = {
    ...existing,
    ...patch,
    loanTypeId: Number(loanTypeId),
    updatedAt: new Date().toISOString(),
  };

  await persistDraftMap(drafts);
  return drafts[key];
};

export const clearLoanTypeDraft = async (loanTypeId) => {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    const drafts = parseStoredValue(raw);
    delete drafts[String(loanTypeId)];
    await persistDraftMap(drafts);
    return true;
  } catch {
    return false;
  }
};
