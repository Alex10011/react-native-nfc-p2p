import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import NFCService, { TagData } from "../services/nfcService";

export default function NFCTag() {
  const [hasNfc, setHasNfc] = useState<boolean | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [lastTagRead, setLastTagRead] = useState<TagData | null>(null);
  const [textToWrite, setTextToWrite] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const isIOS = Platform.OS === "ios";

  useEffect(() => {
    // Initialize NFC when component mounts
    const initializeNFC = async () => {
      try {
        addLog("Initializing NFC...");
        const supported = await NFCService.initialize();
        setHasNfc(supported);

        if (supported) {
          const enabled = await NFCService.checkIsEnabled();
          addLog(`NFC ${enabled ? "enabled" : "disabled"}`);
        } else {
          addLog("NFC not supported on this device");
        }
      } catch (error) {
        addLog(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    };

    initializeNFC();

    // Clean up NFC when component unmounts
    return () => {
      NFCService.cleanup().catch(() => {
        // Ignore cleanup errors
      });
    };
  }, []);

  const addLog = (message: string) => {
    setLogs((prevLogs) => [message, ...prevLogs.slice(0, 19)]);
  };

  const handleReadTag = async () => {
    if (isReading || isWriting) return;

    setIsReading(true);
    setLastTagRead(null);
    addLog("Reading NFC tag...");

    try {
      const tagData = await NFCService.readNFCTag();
      setLastTagRead(tagData);

      addLog("Tag read successfully");
      if (tagData.id) {
        addLog(`Tag ID: ${tagData.id}`);
      }

      if (tagData.rawPayload) {
        addLog(`Content: ${tagData.rawPayload}`);
      }
    } catch (error) {
      addLog(
        `Error reading tag: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      if (
        error instanceof Error &&
        !error.message.includes("cancelled") &&
        !error.message.includes("user")
      ) {
        Alert.alert("Error", `Failed to read NFC tag: ${error.message}`);
      }
    } finally {
      setIsReading(false);
    }
  };

  const handleWriteTag = async () => {
    if (isReading || isWriting || !textToWrite.trim()) return;

    // iOS doesn't support writing to tags
    if (isIOS) {
      Alert.alert(
        "Not Supported",
        "Writing to NFC tags is not supported on iOS devices"
      );
      return;
    }

    setIsWriting(true);
    addLog(`Writing to NFC tag: "${textToWrite}"`);

    try {
      await NFCService.writeToNFCTag(textToWrite);
      addLog("Successfully wrote to NFC tag");
      Alert.alert("Success", "Data was written to the NFC tag");
    } catch (error) {
      addLog(
        `Error writing to tag: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      if (
        error instanceof Error &&
        !error.message.includes("cancelled") &&
        !error.message.includes("user")
      ) {
        Alert.alert("Error", `Failed to write to NFC tag: ${error.message}`);
      }
    } finally {
      setIsWriting(false);
    }
  };

  const renderTagData = () => {
    if (!lastTagRead) return null;

    return (
      <View style={styles.tagDataContainer}>
        <Text style={styles.tagDataTitle}>Last Tag Read:</Text>

        {lastTagRead.id && (
          <View style={styles.tagDataRow}>
            <Text style={styles.tagDataLabel}>ID:</Text>
            <Text style={styles.tagDataValue}>{lastTagRead.id}</Text>
          </View>
        )}

        {lastTagRead.technologiesAvailable && (
          <View style={styles.tagDataRow}>
            <Text style={styles.tagDataLabel}>Technologies:</Text>
            <Text style={styles.tagDataValue}>
              {lastTagRead.technologiesAvailable.join(", ")}
            </Text>
          </View>
        )}

        {lastTagRead.isWritable !== undefined && (
          <View style={styles.tagDataRow}>
            <Text style={styles.tagDataLabel}>Writable:</Text>
            <Text style={styles.tagDataValue}>
              {lastTagRead.isWritable ? "Yes" : "No"}
            </Text>
          </View>
        )}

        {lastTagRead.rawPayload && (
          <View style={styles.tagDataRow}>
            <Text style={styles.tagDataLabel}>Content:</Text>
            <Text style={styles.tagDataValue}>{lastTagRead.rawPayload}</Text>
          </View>
        )}
      </View>
    );
  };

  // If NFC is still being checked
  if (hasNfc === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Checking NFC availability...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If NFC is not supported
  if (hasNfc === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>NFC Tag Operations</Text>
        </View>
        <View style={styles.notSupportedContainer}>
          <Text style={styles.notSupportedText}>
            NFC is not supported on this device
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>NFC Tag Operations</Text>
      </View>

      <ScrollView style={styles.scrollContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Read NFC Tag</Text>
          <Text style={styles.sectionDescription}>
            Hold your device near an NFC tag to read its contents
          </Text>
          <TouchableOpacity
            style={[
              styles.button,
              (isReading || isWriting) && styles.buttonDisabled,
            ]}
            onPress={handleReadTag}
            disabled={isReading || isWriting}
          >
            {isReading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Read NFC Tag</Text>
            )}
          </TouchableOpacity>
        </View>

        {renderTagData()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Write to NFC Tag {isIOS && "(Android Only)"}
          </Text>
          <Text style={styles.sectionDescription}>
            Enter text to write to an NFC tag
          </Text>
          <TextInput
            style={styles.textInput}
            value={textToWrite}
            onChangeText={setTextToWrite}
            placeholder="Enter text to write to the tag"
            placeholderTextColor="#999"
            editable={!isIOS && !isReading && !isWriting}
          />
          <TouchableOpacity
            style={[
              styles.button,
              (isReading || isWriting || isIOS || !textToWrite.trim()) &&
                styles.buttonDisabled,
            ]}
            onPress={handleWriteTag}
            disabled={isReading || isWriting || isIOS || !textToWrite.trim()}
          >
            {isWriting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Write to NFC Tag</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Log</Text>
          <View style={styles.logContainer}>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>
                {log}
              </Text>
            ))}
            {logs.length === 0 && (
              <Text style={styles.emptyLogText}>
                No operations performed yet
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 16,
    backgroundColor: "#007AFF",
    alignItems: "center",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#333",
  },
  notSupportedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  notSupportedText: {
    fontSize: 18,
    color: "#e74c3c",
    textAlign: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  sectionDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
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
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    color: "#333",
  },
  tagDataContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
  },
  tagDataTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  tagDataRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  tagDataLabel: {
    fontWeight: "bold",
    color: "#555",
    width: 100,
  },
  tagDataValue: {
    flex: 1,
    color: "#333",
  },
  logContainer: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  logText: {
    fontSize: 12,
    color: "#333",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 4,
  },
  emptyLogText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
  },
});
