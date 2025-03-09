import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { NfcManager, NfcEvents } from "react-native-nfc-manager";

export default function NFCTag() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>NFCTag</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
});
