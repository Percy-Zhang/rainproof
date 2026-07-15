const { jest: jestGlobal } = require('@jest/globals');

jestGlobal.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock'),
);

require('react-native-reanimated').setUpTests();
