import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Switch,
  ScrollView,
} from "react-native";
import { getCurrentUser, User } from "../models/user";
import {
  Message,
  MessageType,
  createMessage,
  createResponseMessage,
  deserializeMessage,
} from "../models/message";
import NFCService from "../services/nfcService";

// Define error types for better error handling
interface NFCError {
  message?: string;
  [key: string]: any;
}

export default function NFCPage() {
  const [hasNfc, setHasNfc] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isReading, setIsReading] = useState<boolean>(false);
  const [isWriting, setIsWriting] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [operationInProgress, setOperationInProgress] =
    useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const isIOS = Platform.OS === "ios";

  // Add debug info
  const addDebugInfo = (message: string) => {
    setDebugInfo((prev) => [message, ...prev.slice(0, 9)]);
  };

  useEffect(() => {
    const initializeNFC = async () => {
      try {
        // Initialize NFC service
        addDebugInfo("Checking NFC support...");
        const supported = await NFCService.initialize();
        setHasNfc(supported);

        if (supported) {
          const enabled = await NFCService.checkIsEnabled();
          setEnabled(enabled);
          addDebugInfo(`NFC supported and ${enabled ? "enabled" : "disabled"}`);
          addDebugInfo(
            `Device type: ${
              isIOS ? "iOS (Reader Only)" : "Android (Reader/Tag)"
            }`
          );
        } else {
          addDebugInfo("NFC not supported on this device");
        }

        // Initialize current user
        setCurrentUser(getCurrentUser());
      } catch (error) {
        console.error("Error initializing NFC:", error);
        addDebugInfo(
          `Error initializing: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        Alert.alert(
          "Error",
          "Error initializing NFC. Please ensure NFC is enabled on your device."
        );
      }
    };

    initializeNFC();
    return () => {
      // Cleanup on unmount
      NFCService.cleanup().catch(() => {
        /* do nothing */
      });
    };
  }, []);

  const readNFCTag = async () => {
    if (!enabled || operationInProgress) return;

    setIsReading(true);
    setOperationInProgress(true);
    addDebugInfo("Starting NFC read operation...");

    try {
      // Guide user to tap the NFC device
      if (isIOS) {
        // iOS will show system prompt
        addDebugInfo("iOS NFC reader mode activated");
      } else {
        addDebugInfo("Android NFC reader mode activated");
        Alert.alert(
          "NFC Reader",
          "Place your Android device near an NFC tag or another device"
        );
      }

      const rawData = await NFCService.readNFC();
      addDebugInfo(`Received data (length: ${rawData.length})`);
      console.log("Received NFC Data:", rawData);

      processReceivedData(rawData);
    } catch (ex: unknown) {
      console.warn("Error reading NFC:", ex);
      addDebugInfo(
        `Read error: ${ex instanceof Error ? ex.message : String(ex)}`
      );

      // Only show alert if not canceled by user (iOS shows its own dialog)
      if (
        ex &&
        typeof ex === "object" &&
        "message" in ex &&
        typeof ex.message === "string" &&
        !ex.message.includes("cancelled") &&
        !ex.message.includes("user")
      ) {
        Alert.alert("Error", "Error reading NFC tag. Please try again.");
      }
    } finally {
      setIsReading(false);
      setOperationInProgress(false);
    }
  };

  const processReceivedData = (data: string) => {
    try {
      console.log("Processing received data:", data);
      addDebugInfo("Processing received data...");
      const receivedMessage = deserializeMessage(data);

      if (receivedMessage) {
        // Add message to list
        setMessages((prev) => [receivedMessage, ...prev]);
        addDebugInfo(`Message received from: ${receivedMessage.senderName}`);

        // Show alert with content
        Alert.alert(
          "Message Received",
          `From: ${receivedMessage.senderName}\nMessage: ${receivedMessage.content}`
        );
      } else {
        addDebugInfo("Failed to parse message data");
        Alert.alert("Invalid Data", "The data is not a valid message");
      }
    } catch (error) {
      console.error("Error processing received data:", error);
      addDebugInfo(
        `Processing error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      Alert.alert("Error", "Error processing data");
    }
  };

  const sendMessage = async (messageType: MessageType) => {
    if (!currentUser || !enabled || operationInProgress) return;

    // iOS cannot send NFC messages, only read them
    if (isIOS) {
      Alert.alert(
        "iOS Limitation",
        "iOS devices can only read NFC tags, not emulate them. Please use an Android device to send messages."
      );
      return;
    }

    setIsWriting(true);
    setOperationInProgress(true);
    addDebugInfo(
      `Setting up Android to emulate NFC tag with ${messageType} message...`
    );

    try {
      const message = createMessage(currentUser, messageType);
      console.log("Preparing message for tag emulation:", message);

      // On Android, show different guidance
      Alert.alert(
        "Android NFC Tag Mode",
        "Your Android phone is now emulating an NFC tag. Hold an iPhone near this device (with NFC Reader open) to transfer the message."
      );

      await NFCService.sendP2PMessage(message);
      addDebugInfo(`${messageType} message emulation completed`);

      // Add message to list
      setMessages((prev) => [message, ...prev]);
    } catch (error: unknown) {
      console.error(`Error setting up NFC tag emulation:`, error);
      addDebugInfo(
        `Emulation error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      Alert.alert(
        "Error",
        `Error setting up Android as NFC tag. Please try again.`
      );
    } finally {
      setIsWriting(false);
      setOperationInProgress(false);
    }
  };

  const sendResponse = async (originalMessage: Message) => {
    if (!currentUser || !enabled || operationInProgress) return;

    // iOS cannot send NFC messages, only read them
    if (isIOS) {
      Alert.alert(
        "iOS Limitation",
        "iOS devices can only read NFC tags, not emulate them. Please use an Android device to send responses."
      );
      return;
    }

    setIsWriting(true);
    setOperationInProgress(true);
    addDebugInfo(`Setting up response to ${originalMessage.senderName}...`);

    try {
      const response = createResponseMessage(currentUser, originalMessage);

      Alert.alert(
        "Android NFC Tag Mode",
        "Your Android phone is now emulating an NFC tag with the response. Hold an iPhone near this device (with NFC Reader open) to transfer the message."
      );

      await NFCService.sendP2PMessage(response);
      addDebugInfo("Response emulation completed");

      // Add message to list
      setMessages((prev) => [response, ...prev]);
    } catch (error: unknown) {
      console.error("Error sending response:", error);
      addDebugInfo(
        `Response error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      Alert.alert(
        "Error",
        "Error setting up response as NFC tag. Please try again."
      );
    } finally {
      setIsWriting(false);
      setOperationInProgress(false);
    }
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMyMessage = currentUser && item.senderId === currentUser.id;

    return (
      <View
        style={[
          styles.messageItem,
          isMyMessage ? styles.myMessage : styles.otherMessage,
        ]}
      >
        <View style={styles.messageHeader}>
          <Text style={styles.messageSender}>
            {isMyMessage ? "You" : item.senderName}
          </Text>
          <Text style={styles.messageTime}>
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </View>
        <Text style={styles.messageContent}>{item.content}</Text>
        <Text style={styles.messageType}>{item.type}</Text>

        {!isMyMessage && !operationInProgress && !isIOS && (
          <TouchableOpacity
            style={styles.responseButton}
            onPress={() => sendResponse(item)}
            disabled={operationInProgress}
          >
            <Text style={styles.responseButtonText}>Respond</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderInstructions = () => (
    <View style={styles.instructionsContainer}>
      <Text style={styles.instructionsTitle}>
        {isIOS ? "iOS NFC Reader Mode:" : "Android NFC Tag Emulation:"}
      </Text>

      {isIOS ? (
        <>
          <Text style={styles.instructionText}>
            1. Press "Read NFC" on this iPhone
          </Text>
          <Text style={styles.instructionText}>
            2. On an Android device, press "Send Ping"
          </Text>
          <Text style={styles.instructionText}>
            3. Hold this iPhone near the Android device
          </Text>
          <Text style={styles.instructionText}>
            4. Wait for the iOS system prompt to complete
          </Text>
          <Text style={styles.warningText}>
            Note: iOS can only read NFC tags, not emulate them
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.instructionText}>
            1. On an iPhone, press "Read NFC"
          </Text>
          <Text style={styles.instructionText}>
            2. Press "Send Ping" on this Android device
          </Text>
          <Text style={styles.instructionText}>
            3. Hold this Android device near the iPhone
          </Text>
          <Text style={styles.instructionText}>
            4. Keep devices together until reading completes
          </Text>
          <Text style={styles.warningText}>
            Note: Android will emulate an NFC tag for iOS to read
          </Text>
        </>
      )}

      <Text style={styles.warningText}>
        Important: NFC has limited range. Hold devices 1-2cm apart.
      </Text>
    </View>
  );

  const renderDebugSection = () => (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>Debug Info:</Text>
      <ScrollView style={styles.debugScroll}>
        {debugInfo.map((message, index) => (
          <Text key={index} style={styles.debugText}>
            {message}
          </Text>
        ))}
      </ScrollView>
    </View>
  );

  if (hasNfc === null) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.description}>Checking NFC availability...</Text>
      </SafeAreaView>
    );
  }

  if (!hasNfc) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.description}>Your device doesn't support NFC</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          NFC {isIOS ? "Reader" : "Tag Emulator"}
        </Text>
      </View>

      <View style={styles.userInfo}>
        {currentUser && (
          <>
            <Image source={{ uri: currentUser.avatar }} style={styles.avatar} />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{currentUser.name}</Text>
              <Text style={styles.userEmail}>{currentUser.email}</Text>
            </View>
          </>
        )}
      </View>

      {renderInstructions()}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.button,
            (isReading || !enabled || operationInProgress) &&
              styles.buttonDisabled,
          ]}
          onPress={readNFCTag}
          disabled={isReading || !enabled || operationInProgress}
        >
          {isReading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Read NFC</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            (isWriting || !enabled || operationInProgress || isIOS) &&
              styles.buttonDisabled,
          ]}
          onPress={() => sendMessage(MessageType.PING)}
          disabled={isWriting || !enabled || operationInProgress || isIOS}
        >
          {isWriting && messages[0]?.type === MessageType.PING ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Ping</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            (isWriting || !enabled || operationInProgress || isIOS) &&
              styles.buttonDisabled,
          ]}
          onPress={() => sendMessage(MessageType.MARCO)}
          disabled={isWriting || !enabled || operationInProgress || isIOS}
        >
          {isWriting && messages[0]?.type === MessageType.MARCO ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Marco</Text>
          )}
        </TouchableOpacity>
      </View>

      {renderDebugSection()}

      <View style={styles.messageList}>
        <Text style={styles.sectionTitle}>
          Messages {messages.length > 0 ? `(${messages.length})` : ""}
        </Text>
        {messages.length === 0 ? (
          <Text style={styles.emptyState}>No messages yet</Text>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageListContent}
          />
        )}
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
    padding: 16,
    backgroundColor: "#007AFF",
    alignItems: "center",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  userInfo: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e0e0e0",
  },
  userDetails: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    marginVertical: 20,
    color: "#333",
    paddingHorizontal: 20,
  },
  instructionsContainer: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    margin: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  instructionText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: "#e74c3c",
    marginTop: 4,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  debugContainer: {
    backgroundColor: "#f9f9f9",
    margin: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    maxHeight: 100,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#333",
  },
  debugScroll: {
    maxHeight: 80,
  },
  debugText: {
    fontSize: 12,
    color: "#555",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  messageList: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  emptyState: {
    textAlign: "center",
    color: "#888",
    marginTop: 30,
  },
  messageListContent: {
    padding: 4,
  },
  messageItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  myMessage: {
    backgroundColor: "#e3f2fd",
    marginLeft: 30,
    borderBottomRightRadius: 0,
  },
  otherMessage: {
    backgroundColor: "#f5f5f5",
    marginRight: 30,
    borderBottomLeftRadius: 0,
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  messageSender: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#333",
  },
  messageTime: {
    fontSize: 12,
    color: "#888",
  },
  messageContent: {
    fontSize: 16,
    marginBottom: 4,
    color: "#333",
  },
  messageType: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
  responseButton: {
    marginTop: 8,
    padding: 6,
    backgroundColor: "#007AFF",
    borderRadius: 4,
    alignSelf: "flex-end",
  },
  responseButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
});
