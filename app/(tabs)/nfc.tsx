import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  SafeAreaView,
} from "react-native";
import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";

export default function NFCPage() {
  const [hasNfc, setHasNfc] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [tagContent, setTagContent] = useState<string>("");

  useEffect(() => {
    const checkNfc = async () => {
      const supported = await NfcManager.isSupported();
      setHasNfc(supported);
      if (supported) {
        await NfcManager.start();
        setEnabled(true);
      }
    };

    checkNfc();
    return () => {
      // Cleanup on component unmount
      NfcManager.cancelTechnologyRequest().catch(() => {
        /* do nothing */
      });
    };
  }, []);

  const readTag = async () => {
    try {
      setTagContent("");
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      const ndef = tag?.ndefMessage?.[0] || null;

      if (ndef) {
        const decoded = Ndef.text.decodePayload(ndef.payload as any);
        setTagContent(decoded);
        Alert.alert("Success / Éxito", `Tag content / Contenido: ${decoded}`);
      } else {
        setTagContent("No NDEF message found / No se encontró mensaje NDEF");
      }
    } catch (ex) {
      console.warn("Error reading tag:", ex);
      Alert.alert(
        "Error",
        "Error reading NFC tag / Error al leer etiqueta NFC"
      );
    } finally {
      NfcManager.cancelTechnologyRequest();
    }
  };

  if (hasNfc === null) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.description}>
          Checking NFC availability... / Verificando disponibilidad NFC...
        </Text>
      </SafeAreaView>
    );
  }

  if (!hasNfc) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.description}>
          Your device doesn't support NFC / Tu dispositivo no soporta NFC
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>NFC Reader / Lector NFC</Text>
      </View>

      <View style={styles.mainContent}>
        <Text style={styles.description}>
          {enabled
            ? "NFC is ready! / ¡NFC está listo!"
            : "NFC is not enabled / NFC no está habilitado"}
        </Text>

        <TouchableOpacity
          style={[styles.button, !enabled && styles.buttonDisabled]}
          onPress={readTag}
          disabled={!enabled}
        >
          <Text style={styles.buttonText}>
            Read NFC Tag / Leer etiqueta NFC
          </Text>
        </TouchableOpacity>

        {tagContent ? (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Last Read / Última lectura:</Text>
            <Text style={styles.resultContent}>{tagContent}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 20,
    backgroundColor: "#007AFF",
    alignItems: "center",
  },
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  mainContent: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    minWidth: 200,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    width: "100%",
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  resultContent: {
    fontSize: 14,
    color: "#666",
  },
});
