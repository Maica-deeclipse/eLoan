import { registerRootComponent } from 'expo';
import { TurboModuleRegistry } from 'react-native';

import App from './App';

// Some native modules (e.g. PlatformConstants) are accessed via TurboModuleRegistry
// and are not available on web. Provide a small shim to avoid runtime crashes
// when running the app in a web environment. We patch both `get` and
// `getEnforcing` to return a harmless `PlatformConstants` stub.
if (TurboModuleRegistry) {
    if (typeof TurboModuleRegistry.get === 'function') {
        const _origGet = TurboModuleRegistry.get.bind(TurboModuleRegistry);
        TurboModuleRegistry.get = (name) => {
            if (name === 'PlatformConstants') {
                return { forceTouchAvailable: false };
            }
            try {
                return _origGet(name);
            } catch (e) {
                return null;
            }
        };
    }

    if (typeof TurboModuleRegistry.getEnforcing === 'function') {
        const _origGetEnforcing = TurboModuleRegistry.getEnforcing.bind(TurboModuleRegistry);
        TurboModuleRegistry.getEnforcing = (name) => {
            if (name === 'PlatformConstants') {
                return { forceTouchAvailable: false };
            }
            try {
                return _origGetEnforcing(name);
            } catch (e) {
                return null;
            }
        };
    }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
