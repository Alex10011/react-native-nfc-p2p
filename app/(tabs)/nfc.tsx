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

export default function NFCPage() {
  const [hasNfc, setHasNfc] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isReading, setIsReading] = useState<boolean>(false);
  const [isWriting, setIsWriting] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const initializeNFC = async () => {
      try {
        // Inicializar el servicio NFC
        const supported = await NFCService.initialize();
        setHasNfc(supported);

        if (supported) {
          const enabled = await NFCService.checkIsEnabled();
          setEnabled(enabled);
        }

        // Inicializar el usuario actual
        setCurrentUser(getCurrentUser());
      } catch (error) {
        console.error("Error initializing NFC:", error);
        Alert.alert(
          "Error",
          "Error initializing NFC / Error al inicializar NFC"
        );
      }
    };

    initializeNFC();
    return () => {
      // Limpieza al desmontar
      NFCService.cleanup().catch(() => {
        /* do nothing */
      });
    };
  }, []);

  const readNFCTag = async () => {
    if (!enabled || isReading) return;

    setIsReading(true);
    try {
      Alert.alert(
        "NFC Reader / Lector NFC",
        "Place your device near an NFC tag or another NFC device / Acerca tu dispositivo a una etiqueta NFC u otro dispositivo NFC"
      );

      const rawData = await NFCService.readNFC();
      processReceivedData(rawData);
    } catch (ex) {
      console.warn("Error reading NFC:", ex);
      Alert.alert(
        "Error",
        "Error reading NFC tag / Error al leer etiqueta NFC"
      );
    } finally {
      setIsReading(false);
    }
  };

  const processReceivedData = (data: string) => {
    try {
      const receivedMessage = deserializeMessage(data);
      if (receivedMessage) {
        // Añadir mensaje a la lista
        setMessages((prev) => [receivedMessage, ...prev]);

        // Mostrar alerta con contenido
        Alert.alert(
          "Message Received / Mensaje Recibido",
          `${receivedMessage.senderName}: ${receivedMessage.content}`
        );
      } else {
        Alert.alert(
          "Invalid Data / Datos Inválidos",
          "The data is not a valid message / Los datos no son un mensaje válido"
        );
      }
    } catch (error) {
      console.error("Error processing received data:", error);
      Alert.alert("Error", "Error processing data / Error al procesar datos");
    }
  };

  const sendPingMessage = async () => {
    if (!currentUser || !enabled || isWriting) return;

    setIsWriting(true);
    try {
      const message = createMessage(currentUser, MessageType.PING);

      Alert.alert(
        "NFC Writer / Escritor NFC",
        "Place your device near another NFC device / Acerca tu dispositivo a otro dispositivo NFC"
      );

      await NFCService.sendP2PMessage(message);

      // Añadir mensaje a la lista
      setMessages((prev) => [message, ...prev]);

      Alert.alert(
        "Success / Éxito",
        "Ping message sent / Mensaje Ping enviado"
      );
    } catch (error) {
      console.error("Error sending Ping message:", error);
      Alert.alert("Error", "Error sending message / Error al enviar mensaje");
    } finally {
      setIsWriting(false);
    }
  };

  const sendMarcoMessage = async () => {
    if (!currentUser || !enabled || isWriting) return;

    setIsWriting(true);
    try {
      const message = createMessage(currentUser, MessageType.MARCO);

      Alert.alert(
        "NFC Writer / Escritor NFC",
        "Place your device near another NFC device / Acerca tu dispositivo a otro dispositivo NFC"
      );

      await NFCService.sendP2PMessage(message);

      // Añadir mensaje a la lista
      setMessages((prev) => [message, ...prev]);

      Alert.alert(
        "Success / Éxito",
        "Marco message sent / Mensaje Marco enviado"
      );
    } catch (error) {
      console.error("Error sending Marco message:", error);
      Alert.alert("Error", "Error sending message / Error al enviar mensaje");
    } finally {
      setIsWriting(false);
    }
  };

  const sendResponse = async (originalMessage: Message) => {
    if (!currentUser || !enabled || isWriting) return;

    setIsWriting(true);
    try {
      const response = createResponseMessage(currentUser, originalMessage);

      Alert.alert(
        "NFC Writer / Escritor NFC",
        "Place your device near another NFC device / Acerca tu dispositivo a otro dispositivo NFC"
      );

      await NFCService.sendP2PMessage(response);

      // Añadir mensaje a la lista
      setMessages((prev) => [response, ...prev]);

      Alert.alert(
        "Success / Éxito",
        `Response sent: ${response.content} / Respuesta enviada: ${response.content}`
      );
    } catch (error) {
      console.error("Error sending response:", error);
      Alert.alert(
        "Error",
        "Error sending response / Error al enviar respuesta"
      );
    } finally {
      setIsWriting(false);
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
            {isMyMessage ? "Tú / You" : item.senderName}
          </Text>
          <Text style={styles.messageTime}>
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </View>
        <Text style={styles.messageContent}>{item.content}</Text>
        <Text style={styles.messageType}>{item.type}</Text>

        {!isMyMessage && (
          <TouchableOpacity
            style={styles.responseButton}
            onPress={() => sendResponse(item)}
            disabled={isWriting || isReading}
          >
            <Text style={styles.responseButtonText}>Responder / Respond</Text>
          </TouchableOpacity>
        )}
      </View>
    );
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
        <Text style={styles.headerText}>NFC P2P / NFC P2P</Text>
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

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.button,
            (isReading || !enabled) && styles.buttonDisabled,
          ]}
          onPress={readNFCTag}
          disabled={isReading || !enabled}
        >
          {isReading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Read NFC / Leer NFC</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            (isWriting || !enabled) && styles.buttonDisabled,
          ]}
          onPress={sendPingMessage}
          disabled={isWriting || !enabled}
        >
          {isWriting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Ping / Enviar Ping</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            (isWriting || !enabled) && styles.buttonDisabled,
          ]}
          onPress={sendMarcoMessage}
          disabled={isWriting || !enabled}
        >
          {isWriting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Marco / Enviar Marco</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.messageList}>
        <Text style={styles.sectionTitle}>Messages / Mensajes</Text>
        {messages.length === 0 ? (
          <Text style={styles.emptyState}>
            No messages yet / Aún no hay mensajes
          </Text>
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
  actions: {
    flexDirection: "column",
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
    marginVertical: 5,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
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
