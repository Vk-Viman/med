// Dynamic app config for EAS so we can supply google-services.json via a file secret
// Docs: https://docs.expo.dev/eas/environment-variables/#file-environment-variables

/** @type {import('@expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
  return {
    expo: {
      scheme: 'calmspace',
      name: 'CalmSpace',
  slug: 'med',
      version: '1.0.0',
      orientation: 'portrait',
  icon: './assets/icon.png',
      userInterfaceStyle: 'light',
      newArchEnabled: true,
      updates: { enabled: false },
      splash: {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
      ios: {
        supportsTablet: true,
        infoPlist: {
          UIBackgroundModes: ['audio', 'fetch', 'remote-notification'],
        },
      },
      android: {
        package: 'com.vkviman.med',
        adaptiveIcon: {
          // Use the same brand icon for single-color mask; Android will mask this to a squircle/circle as needed
          foregroundImage: './assets/icon.png',
          backgroundColor: '#ffffff',
        },
        edgeToEdgeEnabled: true,
        googleServicesFile,
        permissions: [
          'NOTIFICATIONS',
          'android.permission.RECORD_AUDIO',
          'android.permission.MODIFY_AUDIO_SETTINGS',
        ],
      },
      web: { favicon: './assets/favicon.png' },
      plugins: [
        'expo-router',
        [
          'expo-audio',
          {
            microphonePermission: 'Allow $(PRODUCT_NAME) to access your microphone.',
          },
        ],
        'expo-notifications',
        'expo-secure-store',
      ],
      extra: {
        router: { origin: 'https://vk-viman.github.io', basePath: '/med' },
        apiBase: 'http://192.168.8.105:3000',
        eas: { projectId: '40871f8f-ae29-48bd-9a04-0089eb2a7fc5' },
      },
    },
  };
};
