// Metro configuration for Expo
// Customize symbolicator to collapse Hermes InternalBytecode frames to avoid ENOENT spam during symbolication.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('metro-config').ConfigT} */
const config = getDefaultConfig(__dirname);

config.symbolicator = {
  customizeFrame(frame) {
    try {
      const file = frame?.file || '';
      // Collapse frames that come from Hermes internal bytecode pseudo-file.
      if (/InternalBytecode\.js$/i.test(file) || file.startsWith('address at (InternalBytecode.js')) {
        return { collapse: true };
      }
    } catch {
      // no-op
    }
    return null;
  },
};

module.exports = config;
