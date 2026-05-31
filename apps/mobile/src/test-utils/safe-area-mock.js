const React = require('react');
const { View } = require('react-native');

module.exports = {
  SafeAreaProvider: function (props) {
    return React.createElement(View, { onLayout: props.onLayout }, props.children);
  },
  SafeAreaView: View,
  useSafeAreaInsets: function () {
    return { top: 44, bottom: 34, left: 0, right: 0 };
  },
  SafeAreaConsumer: function (props) {
    return props.children({ top: 44, bottom: 34, left: 0, right: 0 });
  },
};
