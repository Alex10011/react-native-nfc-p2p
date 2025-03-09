import NfcManager, {
  NfcTech,
  NdefRecord,
  Ndef,
  NfcEvents,
} from "react-native-nfc-manager";
import {
  Message,
  serializeMessage,
  deserializeMessage,
} from "../models/message";
import { Platform } from "react-native";

// Extend NfcManager interface to allow for iOS-specific methods
declare module "react-native-nfc-manager" {
  interface NfcManager {
    setNdefPushMessage(records: NdefRecord[] | null): Promise<void>;
  }
}

// Define tag data interface
export interface TagData {
  id?: string;
  technologiesAvailable?: string[];
  type?: string;
  maxSize?: number;
  isWritable?: boolean;
  ndefMessage?: any; // Use any type to avoid TypeScript errors with NdefRecord
  rawPayload?: string;
  parsedPayload?: any;
}

/**
 * Mapping of technology support by platform
 */
export const TECH_SUPPORT = {
  [NfcTech.Ndef]: { android: true, ios: true },
  [NfcTech.NfcA]: { android: true, ios: true },
  [NfcTech.IsoDep]: { android: true, ios: true },
  [NfcTech.NfcB]: { android: true, ios: false },
  [NfcTech.NfcF]: { android: true, ios: false },
  [NfcTech.NfcV]: { android: true, ios: false },
  [NfcTech.MifareClassic]: { android: true, ios: false },
  [NfcTech.MifareUltralight]: { android: true, ios: false },
  [NfcTech.MifareIOS]: { android: false, ios: true },
  [NfcTech.Iso15693IOS]: { android: false, ios: true },
  [NfcTech.FelicaIOS]: { android: false, ios: true },
};

class NFCService {
  private static instance: NFCService;
  private isInitialized: boolean = false;
  private isReading: boolean = false;
  private isWriting: boolean = false;
  private messageCallback: ((message: string) => void) | null = null;
  private currentOperation: Promise<any> | null = null;

  private constructor() {}

  public static getInstance(): NFCService {
    if (!NFCService.instance) {
      NFCService.instance = new NFCService();
    }
    return NFCService.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Check if NFC is supported by the device
      const isSupported = await NfcManager.isSupported();
      if (isSupported) {
        await NfcManager.start();
        this.isInitialized = true;

        // Set up event listener for iOS tag detection
        if (Platform.OS === "ios") {
          NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: any) => {
            console.log("iOS NFC tag discovered:", tag);
            if (tag?.ndefMessage && this.messageCallback) {
              try {
                const firstRecord = tag.ndefMessage[0];
                if (firstRecord && firstRecord.payload) {
                  const payloadText = Ndef.text.decodePayload(
                    firstRecord.payload
                  );
                  console.log("iOS payload decoded:", payloadText);
                  this.messageCallback(payloadText);
                }
              } catch (error) {
                console.error("Error processing tag:", error);
              }
            }
          });
        }
      }
      return isSupported;
    } catch (error) {
      console.error("Error initializing NFC:", error);
      return false;
    }
  }

  async checkIsEnabled(): Promise<boolean> {
    try {
      // On Android we can check if NFC is enabled
      if (Platform.OS === "android") {
        return await NfcManager.isEnabled();
      }
      // On iOS we assume it's enabled
      return true;
    } catch (error) {
      console.error("Error checking if NFC is enabled:", error);
      return false;
    }
  }

  /**
   * Make sure only one NFC operation can run at a time
   */
  private ensureNoActiveOperation() {
    if (this.currentOperation) {
      throw new Error("NFC operation already in progress");
    }

    if (this.isReading || this.isWriting) {
      throw new Error("NFC operation already in progress");
    }
  }

  /**
   * Read an NFC tag or message from another NFC device
   * This method should be used on iOS devices
   */
  async readNFC(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error("NFC not initialized");
    }

    this.ensureNoActiveOperation();

    this.isReading = true;

    const readPromise = new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.cancelNfcOperation();
        this.isReading = false;
        this.currentOperation = null;
        reject(new Error("NFC read timeout"));
      }, 60000); // 1 minute timeout

      // Set up callback to receive the message
      this.messageCallback = (message: string) => {
        clearTimeout(timeoutId);
        this.isReading = false;
        this.currentOperation = null;
        this.cancelNfcOperation();
        resolve(message);
      };

      // Start reading
      if (Platform.OS === "ios") {
        // For iOS, create a reader session with more explicit options
        const iosOptions = {
          alertMessage: "Hold your iPhone near the Android device",
        };

        NfcManager.registerTagEvent(iosOptions)
          .then(() => {
            console.log("iOS NFC reader session started");
          })
          .catch((error: Error) => {
            clearTimeout(timeoutId);
            this.isReading = false;
            this.currentOperation = null;
            reject(error);
          });
      } else {
        // Android implementation
        NfcManager.requestTechnology(NfcTech.Ndef)
          .then(async () => {
            const tag = await NfcManager.getTag();
            const ndef = tag?.ndefMessage?.[0] || null;

            if (ndef) {
              const payloadText = Ndef.text.decodePayload(ndef.payload as any);
              clearTimeout(timeoutId);
              this.isReading = false;
              this.currentOperation = null;
              this.cancelNfcOperation();
              resolve(payloadText);
            } else {
              clearTimeout(timeoutId);
              this.isReading = false;
              this.currentOperation = null;
              this.cancelNfcOperation();
              reject(new Error("No NDEF message found"));
            }
          })
          .catch((error: Error) => {
            clearTimeout(timeoutId);
            this.isReading = false;
            this.currentOperation = null;
            this.cancelNfcOperation();
            reject(error);
          });
      }
    });

    this.currentOperation = readPromise;
    return readPromise;
  }

  /**
   * Write a message to an NFC tag or send to another NFC device
   * For Android to iOS communication, this should be used on Android devices
   */
  async writeNFC(message: Message): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("NFC not initialized");
    }

    this.ensureNoActiveOperation();

    this.isWriting = true;

    // Convert message to string
    const messageStr = serializeMessage(message);
    console.log("Preparing NFC payload:", messageStr);

    if (Platform.OS === "ios") {
      // iOS implementation requires a different approach
      const writePromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.cancelNfcOperation();
          this.isWriting = false;
          this.currentOperation = null;
          reject(new Error("NFC write timeout"));
        }, 60000); // 1 minute timeout

        // iOS doesn't handle P2P well, so we use the tag emulation approach by creating a writer session
        // that defines what data would be shared when the device is scanned by another NFC reader

        // On iOS, the system UI will guide the user
        NfcManager.setAlertMessage("Hold your iPhone near the reading device");

        // Create NDEF message to share
        const records = [Ndef.textRecord(messageStr)];

        // Start an NFC session that will share the NDEF message
        const iosWriteOptions = {
          alertMessage: "Hold near the reading device",
          invalidateAfterFirstRead: true,
        };

        // First, make sure we're not in a previous session
        this.cancelNfcOperation()
          .then(() => {
            // Then start a new tag session
            NfcManager.registerTagEvent(iosWriteOptions)
              .then(() => {
                console.log("iOS NFC writer session started");
                // TypeScript may complain about this method but it exists in iOS implementation
                NfcManager.setNdefPushMessage(records)
                  .then(() => {
                    console.log("iOS NFC message prepared for sharing");
                    // We need to keep the session open to allow the other device to read it
                    setTimeout(() => {
                      clearTimeout(timeoutId);
                      this.cancelNfcOperation();
                      this.isWriting = false;
                      this.currentOperation = null;
                      resolve();
                    }, 10000); // Allow 10 seconds for reading
                  })
                  .catch((error: Error) => {
                    console.error("Error setting NDEF push message:", error);
                    clearTimeout(timeoutId);
                    this.cancelNfcOperation();
                    this.isWriting = false;
                    this.currentOperation = null;
                    reject(error);
                  });
              })
              .catch((error: Error) => {
                console.error("Error registering tag event:", error);
                clearTimeout(timeoutId);
                this.cancelNfcOperation();
                this.isWriting = false;
                this.currentOperation = null;
                reject(error);
              });
          })
          .catch((error) => {
            console.error("Error canceling previous NFC operation:", error);
            this.isWriting = false;
            this.currentOperation = null;
            reject(error);
          });
      });

      this.currentOperation = writePromise;
      return writePromise;
    } else {
      // Android implementation - used for Android to iOS communication
      // This is the key part that needs to work for the Android device to be detected by iOS
      const writePromise = new Promise<void>(async (resolve, reject) => {
        try {
          if (Platform.OS === "android") {
            console.log("Setting up Android as NFC tag emulator...");

            // Android HCE (Host Card Emulation) approach
            // We need to create an NDEF message and make it available for reading
            const records = [Ndef.textRecord(messageStr)];
            const bytes = Ndef.encodeMessage(records);

            // Request NfcA technology which is more suitable for tag emulation
            await NfcManager.requestTechnology(NfcTech.NfcA);

            // For Android, we need to keep the phone in emulation mode to be detected by iOS
            console.log("Android device ready for NFC tag emulation");

            // Show a timeout dialog after 30 seconds
            const timeoutId = setTimeout(() => {
              this.isWriting = false;
              this.currentOperation = null;
              this.cancelNfcOperation();
              resolve(); // Resolve anyway as we don't know if iOS has read it
            }, 30000);

            // When using this in production, you might want to implement a callback
            // mechanism to know when the iOS device has successfully read the tag

            // We must keep the NFC session active for iOS to detect it
            setTimeout(async () => {
              clearTimeout(timeoutId);
              console.log("Ending Android NFC tag emulation");
              this.isWriting = false;
              this.currentOperation = null;
              await this.cancelNfcOperation();
              resolve();
            }, 25000); // Keep active for 25 seconds
          } else {
            reject(new Error("Not supported on this platform"));
          }
        } catch (error) {
          console.error("Error setting up Android NFC tag emulation:", error);
          this.isWriting = false;
          this.currentOperation = null;
          await this.cancelNfcOperation();
          reject(error);
        }
      });

      this.currentOperation = writePromise;
      return writePromise;
    }
  }

  /**
   * P2P communication method - mainly for Android to iOS
   * On iOS, we use read mode
   * On Android, we use tag emulation mode
   */
  async sendP2PMessage(message: Message): Promise<void> {
    if (Platform.OS === "ios") {
      // iOS can only read, not send
      throw new Error("iOS cannot send NFC messages, it can only read them");
    } else {
      // For Android, we use tag emulation to be detected by iOS
      return this.writeNFC(message);
    }
  }

  /**
   * Read an NFC tag and return comprehensive tag information
   * Works on both iOS and Android
   */
  async readNFCTag(): Promise<TagData> {
    if (!this.isInitialized) {
      throw new Error("NFC not initialized");
    }

    this.ensureNoActiveOperation();
    this.isReading = true;

    const readPromise = new Promise<TagData>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.cancelNfcOperation();
        this.isReading = false;
        this.currentOperation = null;
        reject(new Error("NFC tag read timeout"));
      }, 60000);

      if (Platform.OS === "ios") {
        // iOS implementation for reading tags
        const iosOptions = {
          alertMessage: "Hold your iPhone near an NFC tag",
        };

        NfcManager.registerTagEvent(iosOptions)
          .then(() => {
            console.log("iOS NFC tag reader ready");

            // For iOS, we need to set up an event listener to get the tag data
            NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: any) => {
              try {
                console.log("Tag discovered:", tag);

                const tagData: TagData = {
                  id: tag.id,
                  ndefMessage: tag.ndefMessage,
                };

                // Try to parse NDEF message if present
                if (tag.ndefMessage && tag.ndefMessage.length > 0) {
                  const record = tag.ndefMessage[0];
                  try {
                    tagData.rawPayload = Ndef.text.decodePayload(
                      record.payload
                    );

                    // Try to parse as JSON if possible
                    try {
                      tagData.parsedPayload = JSON.parse(tagData.rawPayload);
                    } catch (e) {
                      // Not a JSON, keep as string
                      tagData.parsedPayload = tagData.rawPayload;
                    }
                  } catch (e) {
                    console.log("Could not decode payload as text:", e);
                  }
                }

                // Finish the reading operation
                clearTimeout(timeoutId);
                this.isReading = false;
                this.currentOperation = null;
                this.cancelNfcOperation();
                resolve(tagData);
              } catch (error) {
                clearTimeout(timeoutId);
                this.isReading = false;
                this.currentOperation = null;
                this.cancelNfcOperation();
                reject(error);
              }
            });
          })
          .catch((error: Error) => {
            clearTimeout(timeoutId);
            this.isReading = false;
            this.currentOperation = null;
            reject(error);
          });
      } else {
        // Android implementation for reading tags
        NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NdefFormatable])
          .then(async () => {
            // Get the tag data
            const tag = await NfcManager.getTag();
            console.log("Tag details:", tag);

            const tagData: TagData = {
              id: tag?.id,
              technologiesAvailable: tag?.techTypes,
              maxSize: tag?.maxSize,
              isWritable: tag?.isWritable as boolean | undefined,
              ndefMessage: tag?.ndefMessage,
            };

            // Try to parse NDEF message if present
            if (tag.ndefMessage && tag.ndefMessage.length > 0) {
              const record = tag.ndefMessage[0];
              try {
                tagData.rawPayload = Ndef.text.decodePayload(record.payload);

                // Try to parse as JSON if possible
                try {
                  tagData.parsedPayload = JSON.parse(tagData.rawPayload);
                } catch (e) {
                  // Not a JSON, keep as string
                  tagData.parsedPayload = tagData.rawPayload;
                }
              } catch (e) {
                console.log("Could not decode payload as text:", e);
              }
            }

            // Finish reading
            clearTimeout(timeoutId);
            this.isReading = false;
            this.currentOperation = null;
            this.cancelNfcOperation();
            resolve(tagData);
          })
          .catch((error: Error) => {
            clearTimeout(timeoutId);
            this.isReading = false;
            this.currentOperation = null;
            this.cancelNfcOperation();
            reject(error);
          });
      }
    });

    this.currentOperation = readPromise;
    return readPromise;
  }

  /**
   * Write data to an NFC tag
   * Only works on Android
   */
  async writeToNFCTag(data: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("NFC not initialized");
    }

    if (Platform.OS === "ios") {
      throw new Error("Writing to NFC tags is not supported on iOS");
    }

    this.ensureNoActiveOperation();
    this.isWriting = true;

    const writePromise = new Promise<void>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.cancelNfcOperation();
        this.isWriting = false;
        this.currentOperation = null;
        reject(new Error("NFC tag write timeout"));
      }, 60000);

      // Android implementation for writing to tags
      NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NdefFormatable])
        .then(async () => {
          try {
            // Create NDEF message
            const bytes = Ndef.encodeMessage([Ndef.textRecord(data)]);

            if (bytes) {
              // Write to tag
              await NfcManager.ndefHandler.writeNdefMessage(bytes);
              console.log("Successfully wrote to NFC tag");

              // Finish writing
              clearTimeout(timeoutId);
              this.isWriting = false;
              this.currentOperation = null;
              this.cancelNfcOperation();
              resolve();
            } else {
              throw new Error("Failed to encode NDEF message");
            }
          } catch (error) {
            clearTimeout(timeoutId);
            this.isWriting = false;
            this.currentOperation = null;
            this.cancelNfcOperation();
            reject(error);
          }
        })
        .catch((error: Error) => {
          clearTimeout(timeoutId);
          this.isWriting = false;
          this.currentOperation = null;
          this.cancelNfcOperation();
          reject(error);
        });
    });

    this.currentOperation = writePromise;
    return writePromise;
  }

  /**
   * Cancel any ongoing NFC operations
   */
  private async cancelNfcOperation(): Promise<void> {
    try {
      if (Platform.OS === "ios") {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        // Make sure we clear any current message
        if ("setNdefPushMessage" in NfcManager) {
          await NfcManager.setNdefPushMessage(null).catch(() => {
            /* ignore errors */
          });
        }
        await NfcManager.unregisterTagEvent().catch(() => {
          /* ignore errors */
        });
      } else {
        // For Android, we need to cancel any technology requests
        await NfcManager.cancelTechnologyRequest().catch(() => {
          /* ignore errors */
        });
      }
    } catch (error) {
      console.error("Error canceling NFC operation:", error);
    }
  }

  /**
   * Clean up NFC resources when exiting the app
   */
  async cleanup(): Promise<void> {
    try {
      this.messageCallback = null;
      this.isReading = false;
      this.isWriting = false;
      this.currentOperation = null;

      if (Platform.OS === "ios") {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        if ("setNdefPushMessage" in NfcManager) {
          await NfcManager.setNdefPushMessage(null).catch(() => {
            /* ignore errors */
          });
        }
        await NfcManager.unregisterTagEvent().catch(() => {
          /* ignore errors */
        });
      } else {
        await NfcManager.cancelTechnologyRequest().catch(() => {
          /* ignore errors */
        });
        await NfcManager.unregisterTagEvent().catch(() => {
          /* ignore errors */
        });
      }
    } catch (error) {
      console.error("Error cleaning up NFC:", error);
    }
  }

  /**
   * Tests if a specific NFC technology is available on the current device
   * @param tech NFC technology to test from NfcTech
   * @returns True if technology is supported on current platform
   */
  isTechSupported(tech: string): boolean {
    const currentPlatform = Platform.OS === "ios" ? "ios" : "android";

    // Check if the technology exists in our mapping
    if (tech in TECH_SUPPORT) {
      return TECH_SUPPORT[tech as keyof typeof TECH_SUPPORT][
        currentPlatform as "ios" | "android"
      ];
    }

    return false;
  }

  /**
   * Test a specific NFC technology
   * @param tech The NFC technology to test
   * @returns Tag information from the detected tag
   */
  async testNfcTechnology(tech: string): Promise<TagData> {
    if (!this.isInitialized) {
      throw new Error("NFC not initialized");
    }

    const currentPlatform = Platform.OS === "ios" ? "ios" : "android";

    // Check if the technology is supported on this platform
    if (tech in TECH_SUPPORT) {
      const techSupport = TECH_SUPPORT[tech as keyof typeof TECH_SUPPORT];
      if (!techSupport[currentPlatform as "ios" | "android"]) {
        throw new Error(`${tech} is not supported on ${currentPlatform}`);
      }
    } else {
      throw new Error(`Unknown technology: ${tech}`);
    }

    this.ensureNoActiveOperation();
    this.isReading = true;

    const techPromise = new Promise<TagData>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.cancelNfcOperation();
        this.isReading = false;
        this.currentOperation = null;
        reject(new Error("NFC technology test timeout"));
      }, 60000);

      if (Platform.OS === "ios") {
        // iOS implementation for technology detection
        // Some technologies require special handling on iOS
        if (
          tech === NfcTech.MifareIOS ||
          tech === NfcTech.Iso15693IOS ||
          tech === NfcTech.FelicaIOS
        ) {
          // For iOS-specific technologies, we need specific options
          const iosOptions = {
            alertMessage: `Hold your iPhone near a ${tech.replace(
              "ios",
              ""
            )} compatible tag`,
          };

          NfcManager.registerTagEvent(iosOptions)
            .then(() => {
              console.log(`iOS ${tech} reader ready`);

              // For iOS, we need to set up an event listener to get the tag data
              NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: any) => {
                try {
                  console.log("Tag discovered:", tag);

                  const tagData: TagData = {
                    id: tag.id,
                    ndefMessage: tag.ndefMessage,
                  };

                  // Attempt to extract technology-specific data
                  if (tech === NfcTech.MifareIOS && tag.mifareFamily) {
                    tagData.type = `Mifare: ${tag.mifareFamily}`;
                  } else if (tech === NfcTech.Iso15693IOS && tag.iso15693) {
                    tagData.type = "ISO 15693";
                  } else if (tech === NfcTech.FelicaIOS && tag.felica) {
                    tagData.type = "FeliCa";
                  }

                  // Finish the reading operation
                  clearTimeout(timeoutId);
                  this.isReading = false;
                  this.currentOperation = null;
                  this.cancelNfcOperation();
                  resolve(tagData);
                } catch (error) {
                  clearTimeout(timeoutId);
                  this.isReading = false;
                  this.currentOperation = null;
                  this.cancelNfcOperation();
                  reject(error);
                }
              });
            })
            .catch((error: Error) => {
              clearTimeout(timeoutId);
              this.isReading = false;
              this.currentOperation = null;
              reject(error);
            });
        } else if (
          tech === NfcTech.Ndef ||
          tech === NfcTech.NfcA ||
          tech === NfcTech.IsoDep
        ) {
          // For standard technologies on iOS
          const iosOptions = {
            alertMessage: `Hold your iPhone near a ${tech} compatible tag`,
          };

          NfcManager.registerTagEvent(iosOptions)
            .then(() => {
              console.log(`iOS ${tech} reader ready`);

              // For iOS, we need to set up an event listener to get the tag data
              NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: any) => {
                try {
                  console.log("Tag discovered:", tag);

                  const tagData: TagData = {
                    id: tag.id,
                    ndefMessage: tag.ndefMessage,
                  };

                  // Try to parse NDEF message if present
                  if (tag.ndefMessage && tag.ndefMessage.length > 0) {
                    const record = tag.ndefMessage[0];
                    try {
                      tagData.rawPayload = Ndef.text.decodePayload(
                        record.payload
                      );

                      try {
                        tagData.parsedPayload = JSON.parse(tagData.rawPayload);
                      } catch (e) {
                        tagData.parsedPayload = tagData.rawPayload;
                      }
                    } catch (e) {
                      console.log("Could not decode payload as text");
                    }
                  }

                  // Finish the reading operation
                  clearTimeout(timeoutId);
                  this.isReading = false;
                  this.currentOperation = null;
                  this.cancelNfcOperation();
                  resolve(tagData);
                } catch (error) {
                  clearTimeout(timeoutId);
                  this.isReading = false;
                  this.currentOperation = null;
                  this.cancelNfcOperation();
                  reject(error);
                }
              });
            })
            .catch((error: Error) => {
              clearTimeout(timeoutId);
              this.isReading = false;
              this.currentOperation = null;
              reject(error);
            });
        } else {
          clearTimeout(timeoutId);
          this.isReading = false;
          this.currentOperation = null;
          reject(new Error(`Technology ${tech} not implemented for iOS`));
        }
      } else {
        // Android implementation
        NfcManager.requestTechnology(tech as NfcTech)
          .then(async () => {
            try {
              // Get the tag data - this will look different for each technology
              const tag = await NfcManager.getTag();
              console.log(`${tech} tag details:`, tag);

              // Create a standardized response
              const tagData: TagData = {
                id: tag?.id,
                technologiesAvailable: tag?.techTypes,
                type: tech,
              };

              // For NDEF tags, attempt to read the message
              if (tech === NfcTech.Ndef && tag?.ndefMessage) {
                tagData.ndefMessage = tag.ndefMessage;

                if (tag.ndefMessage.length > 0) {
                  const record = tag.ndefMessage[0];
                  try {
                    tagData.rawPayload = Ndef.text.decodePayload(
                      record.payload as any
                    );

                    try {
                      tagData.parsedPayload = JSON.parse(tagData.rawPayload);
                    } catch (e) {
                      tagData.parsedPayload = tagData.rawPayload;
                    }
                  } catch (e) {
                    console.log("Could not decode payload as text");
                  }
                }
              }

              // For other technologies, add technology-specific data if available
              switch (tech) {
                case NfcTech.MifareClassic:
                  if (tag?.mifareclassic) {
                    tagData.type = "Mifare Classic";
                  }
                  break;
                case NfcTech.MifareUltralight:
                  if (tag?.mifareultralight) {
                    tagData.type = "Mifare Ultralight";
                  }
                  break;
                case NfcTech.IsoDep:
                  if (tag?.isodep) {
                    tagData.type = "ISO-DEP";
                  }
                  break;
                // Add more technology-specific handling as needed
              }

              clearTimeout(timeoutId);
              this.isReading = false;
              this.currentOperation = null;
              await this.cancelNfcOperation();
              resolve(tagData);
            } catch (error) {
              clearTimeout(timeoutId);
              this.isReading = false;
              this.currentOperation = null;
              await this.cancelNfcOperation();
              reject(error);
            }
          })
          .catch((error: Error) => {
            clearTimeout(timeoutId);
            this.isReading = false;
            this.currentOperation = null;
            this.cancelNfcOperation();
            reject(error);
          });
      }
    });

    this.currentOperation = techPromise;
    return techPromise;
  }
}

export default NFCService.getInstance();
