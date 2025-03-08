import NfcManager, {
  NfcTech,
  NdefRecord,
  Ndef,
} from "react-native-nfc-manager";
import {
  Message,
  serializeMessage,
  deserializeMessage,
} from "../models/message";
import { Platform } from "react-native";

class NFCService {
  private static instance: NFCService;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): NFCService {
    if (!NFCService.instance) {
      NFCService.instance = new NFCService();
    }
    return NFCService.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Comprobar si NFC es compatible con el dispositivo
      const isSupported = await NfcManager.isSupported();
      if (isSupported) {
        await NfcManager.start();
        this.isInitialized = true;
      }
      return isSupported;
    } catch (error) {
      console.error("Error initializing NFC:", error);
      return false;
    }
  }

  async checkIsEnabled(): Promise<boolean> {
    try {
      // En Android podemos comprobar si NFC está habilitado
      if (Platform.OS === "android") {
        return await NfcManager.isEnabled();
      }
      // En iOS no podemos comprobar, asumimos que está habilitado
      return true;
    } catch (error) {
      console.error("Error checking if NFC is enabled:", error);
      return false;
    }
  }

  /**
   * Lee una etiqueta NFC o un mensaje de otro dispositivo NFC
   */
  async readNFC(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error("NFC not initialized");
    }

    try {
      // Solicitar tecnología NFC
      await NfcManager.requestTechnology(NfcTech.Ndef);

      // Leer la etiqueta
      const tag = await NfcManager.getTag();
      const ndef = tag?.ndefMessage?.[0] || null;

      // Cancelar la solicitud de tecnología
      await NfcManager.cancelTechnologyRequest();

      if (ndef) {
        // Decodificar el payload
        return Ndef.text.decodePayload(ndef.payload as any);
      } else {
        throw new Error("No NDEF message found");
      }
    } catch (error) {
      console.error("Error reading NFC:", error);
      // Asegurarse de cancelar la solicitud de tecnología en caso de error
      NfcManager.cancelTechnologyRequest().catch(() => {
        // Ignorar errores al cancelar
      });
      throw error;
    }
  }

  /**
   * Escribe un mensaje en una etiqueta NFC o lo envía a otro dispositivo NFC
   */
  async writeNFC(message: Message): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("NFC not initialized");
    }

    try {
      // Convertir el mensaje a string
      const messageStr = serializeMessage(message);

      // Solicitar tecnología NFC
      await NfcManager.requestTechnology(NfcTech.Ndef);

      // Crear un registro NDEF con el mensaje
      const bytes = Ndef.encodeMessage([Ndef.textRecord(messageStr)]);

      if (bytes) {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        console.log("Message written successfully");
      }
    } catch (error) {
      console.error("Error writing NFC message:", error);
      throw error;
    } finally {
      // Asegurarse de cancelar la solicitud de tecnología
      NfcManager.cancelTechnologyRequest().catch(() => {
        // Ignorar errores al cancelar
      });
    }
  }

  /**
   * Función específica para comunicación P2P
   * Puede requerir ajustes según la implementación específica
   */
  async sendP2PMessage(message: Message): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("NFC not initialized");
    }

    try {
      // Convertir el mensaje a string
      const messageStr = serializeMessage(message);

      // Solicitar tecnología NFC para P2P (HCE en Android, NFCNDEFReaderSession en iOS)
      if (Platform.OS === "android") {
        await NfcManager.requestTechnology(NfcTech.NfcA);
      } else {
        await NfcManager.requestTechnology(NfcTech.Ndef);
      }

      // Crear un registro NDEF con el mensaje
      const bytes = Ndef.encodeMessage([Ndef.textRecord(messageStr)]);

      // En Android, usamos transceive para enviar datos en modo P2P
      if (Platform.OS === "android" && bytes) {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
      } else if (bytes) {
        // En iOS, el proceso es similar a la escritura
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
      }

      console.log("P2P message sent successfully");
    } catch (error) {
      console.error("Error sending P2P message:", error);
      throw error;
    } finally {
      // Asegurarse de cancelar la solicitud de tecnología
      NfcManager.cancelTechnologyRequest().catch(() => {
        // Ignorar errores al cancelar
      });
    }
  }

  /**
   * Limpia los recursos de NFC al salir de la app
   */
  async cleanup(): Promise<void> {
    try {
      NfcManager.cancelTechnologyRequest();
      NfcManager.unregisterTagEvent();
    } catch (error) {
      console.error("Error cleaning up NFC:", error);
    }
  }
}

export default NFCService.getInstance();
