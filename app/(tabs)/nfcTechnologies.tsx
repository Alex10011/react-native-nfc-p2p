import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import NFCService, { TECH_SUPPORT, TagData } from "../services/nfcService";
import { NfcTech } from "react-native-nfc-manager";

// Get all available NFC technologies from NfcTech
const ALL_TECHNOLOGIES = Object.values(NfcTech);

export default function NFCTechnologies() {
  const [hasNfc, setHasNfc] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [currentTech, setCurrentTech] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<TagData | null>(null);
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
    setLogs((prev) => [message, ...prev.slice(0, 19)]);
  };

  const testTechnology = async (tech: string) => {
    if (isScanning) return;

    // Check if the technology is supported on this platform
    if (!NFCService.isTechSupported(tech)) {
      Alert.alert(
        "Not Supported",
        `The ${tech} technology is not supported on ${
          isIOS ? "iOS" : "Android"
        } devices`
      );
      return;
    }

    setIsScanning(true);
    setCurrentTech(tech);
    setLastScanResult(null);
    addLog(`Testing ${tech} technology...`);

    try {
      const result = await NFCService.testNfcTechnology(tech);
      setLastScanResult(result);

      addLog(`${tech} scan successful`);
      if (result.id) {
        addLog(`Tag ID: ${result.id}`);
      }

      if (result.rawPayload) {
        addLog(`Content: ${result.rawPayload}`);
      }
    } catch (error) {
      addLog(
        `${tech} error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      if (
        error instanceof Error &&
        !error.message.includes("cancelled") &&
        !error.message.includes("user")
      ) {
        Alert.alert("Error", `Failed to scan with ${tech}: ${error.message}`);
      }
    } finally {
      setIsScanning(false);
      setCurrentTech(null);
    }
  };

  const renderTechButton = (tech: string) => {
    const isSupported = NFCService.isTechSupported(tech);
    const isActive = currentTech === tech;

    return (
      <TouchableOpacity
        key={tech}
        style={[
          styles.techButton,
          !isSupported && styles.unsupportedButton,
          isActive && styles.activeButton,
          isScanning && tech !== currentTech && styles.disabledButton,
        ]}
        onPress={() => testTechnology(tech)}
        disabled={!isSupported || (isScanning && tech !== currentTech)}
      >
        {isActive && isScanning ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Text style={styles.techButtonText}>{tech}</Text>
            <Text style={styles.supportText}>{isSupported ? "✅" : "❌"}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderScanResult = () => {
    if (!lastScanResult) return null;

    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>Last Scan Result:</Text>

        {lastScanResult.id && (
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>ID:</Text>
            <Text style={styles.resultValue}>{lastScanResult.id}</Text>
          </View>
        )}

        {lastScanResult.type && (
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Type:</Text>
            <Text style={styles.resultValue}>{lastScanResult.type}</Text>
          </View>
        )}

        {lastScanResult.technologiesAvailable && (
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Technologies:</Text>
            <Text style={styles.resultValue}>
              {lastScanResult.technologiesAvailable.join(", ")}
            </Text>
          </View>
        )}

        {lastScanResult.rawPayload && (
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Content:</Text>
            <Text style={styles.resultValue}>{lastScanResult.rawPayload}</Text>
          </View>
        )}

        {lastScanResult.parsedPayload && (
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Parsed Data:</Text>
            <Text style={styles.resultValue}>
              {typeof lastScanResult.parsedPayload === "object"
                ? JSON.stringify(lastScanResult.parsedPayload, null, 2)
                : String(lastScanResult.parsedPayload)}
            </Text>
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
          <Text style={styles.headerText}>NFC Technologies Test</Text>
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
        <Text style={styles.headerText}>NFC Technologies Test</Text>
      </View>

      <ScrollView style={styles.scrollContainer}>
        <View style={styles.platformInfo}>
          <Text style={styles.platformTitle}>
            Platform: {Platform.OS === "ios" ? "iOS" : "Android"}
          </Text>
          <Text style={styles.platformDescription}>
            Select a technology to test. Only supported technologies on your
            platform can be tested.
          </Text>
        </View>

        <View style={styles.techGrid}>
          {ALL_TECHNOLOGIES.map((tech) => renderTechButton(tech))}
        </View>

        {renderScanResult()}

        <View style={styles.logSection}>
          <Text style={styles.logTitle}>Activity Log:</Text>
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
  platformInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  platformTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  platformDescription: {
    fontSize: 14,
    color: "#666",
  },
  techGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  techButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    margin: 8,
    minWidth: 120,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  unsupportedButton: {
    backgroundColor: "#e0e0e0",
  },
  activeButton: {
    backgroundColor: "#4CD964",
  },
  disabledButton: {
    opacity: 0.5,
  },
  techButtonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
    marginRight: 6,
  },
  supportText: {
    fontSize: 16,
  },
  resultContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  resultRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  resultLabel: {
    fontWeight: "bold",
    color: "#555",
    width: 100,
  },
  resultValue: {
    flex: 1,
    color: "#333",
  },
  logSection: {
    padding: 16,
  },
  logTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
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
