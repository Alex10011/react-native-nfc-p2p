import { User } from "./user";

export enum MessageType {
  PING = "PING",
  PONG = "PONG",
  MARCO = "MARCO",
  POLO = "POLO",
  INFO = "INFO",
  GREETING = "GREETING",
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string;
  timestamp: number;
  responseToId?: string;
}

export function createMessage(
  sender: User,
  type: MessageType,
  content?: string,
  responseToId?: string
): Message {
  const id = `msg_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  // Contenido predeterminado basado en el tipo de mensaje
  let messageContent = content || "";
  if (!content) {
    switch (type) {
      case MessageType.PING:
        messageContent = "¡Ping!";
        break;
      case MessageType.PONG:
        messageContent = "¡Pong!";
        break;
      case MessageType.MARCO:
        messageContent = "¡Marco!";
        break;
      case MessageType.POLO:
        messageContent = "¡Polo!";
        break;
      case MessageType.GREETING:
        messageContent = `¡Hola! Soy ${sender.name}`;
        break;
      case MessageType.INFO:
        messageContent = "Información del usuario";
        break;
    }
  }

  return {
    id,
    senderId: sender.id,
    senderName: sender.name,
    type,
    content: messageContent,
    timestamp: Date.now(),
    responseToId,
  };
}

export function createResponseMessage(
  sender: User,
  originalMessage: Message
): Message {
  let responseType: MessageType;

  // Determinar el tipo de respuesta apropiado
  switch (originalMessage.type) {
    case MessageType.PING:
      responseType = MessageType.PONG;
      break;
    case MessageType.PONG:
      responseType = MessageType.PING;
      break;
    case MessageType.MARCO:
      responseType = MessageType.POLO;
      break;
    case MessageType.POLO:
      responseType = MessageType.MARCO;
      break;
    case MessageType.GREETING:
      responseType = MessageType.GREETING;
      break;
    default:
      responseType = MessageType.INFO;
  }

  return createMessage(sender, responseType, undefined, originalMessage.id);
}

// Función para serializar un mensaje a formato JSON para transmitir por NFC
export function serializeMessage(message: Message): string {
  return JSON.stringify(message);
}

// Función para deserializar un mensaje desde formato JSON recibido por NFC
export function deserializeMessage(jsonString: string): Message | null {
  try {
    return JSON.parse(jsonString) as Message;
  } catch (error) {
    console.error("Error deserializando mensaje:", error);
    return null;
  }
}
