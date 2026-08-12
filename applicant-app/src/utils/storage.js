import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';
const STORAGE_PREFIX = 'eLoan:';

const storageKey = (key) => `${STORAGE_PREFIX}${key}`;

export async function getItemAsync(key) {
    if (isWeb) {
        return Promise.resolve(localStorage.getItem(storageKey(key)));
    }
    return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key, value) {
    if (isWeb) {
        localStorage.setItem(storageKey(key), value);
        return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key) {
    if (isWeb) {
        localStorage.removeItem(storageKey(key));
        return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
}
