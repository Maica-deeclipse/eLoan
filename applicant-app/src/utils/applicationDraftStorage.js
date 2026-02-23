import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'application_wizard_drafts_v1';

const parseStoredValue = (value) => {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const persistDraftMap = async (draftMap) => {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(draftMap));
};

export const getLoanTypeDraft = async (loanTypeId) => {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    const drafts = parseStoredValue(raw);
    return drafts[String(loanTypeId)] || null;
  } catch {
    return null;
  }
};

export const saveLoanTypeDraft = async (loanTypeId, patch) => {
  try {
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
  } catch {
    return null;
  }
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
