export enum AppState {
  LOCKED = 'LOCKED',
  SCANNING = 'SCANNING',
  CONNECTING = 'CONNECTING',
  AUTHORIZED = 'AUTHORIZED',
  LISTENING = 'LISTENING',
  SPEAKING = 'SPEAKING',
}

export enum OSView {
  NEXUS = 'NEXUS', 
  TERMINAL = 'TERMINAL',
  DATA_STREAM = 'DATA_STREAM',
  SECURITY = 'SECURITY'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
}

export interface SubAgent {
  id: string;
  name: string;
  status: 'IDLE' | 'WORKING' | 'OFFLINE';
  specialty: string;
}

export interface SystemStats {
  cpu: number;
  quantumStability: number;
  networkLat: number;
  encryptionLevel: string;
}