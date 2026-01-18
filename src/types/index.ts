// ==========================
// Data Models
// ==========================

export type SlideType = 'title' | 'bible' | 'lyrics' | 'imageText';
export type AlignType = 'center' | 'left';
export type SplitMode = 'koOnly' | 'enOnly' | 'koEn';
export type BlackoutMode = 'none' | 'black' | 'white';

export interface SlideContent {
  title?: string;
  body?: string;
  korean?: string;
  english?: string;
  imageUrl?: string;
  reference?: string; // Bible reference like "John 3:16"
}

export interface SlideLayout {
  align: AlignType;
  splitMode?: SplitMode;
}

export interface ComputedStyle {
  fontSizeMain: number;
  fontSizeSub: number;
  lineHeightMain: number;
  lineHeightSub: number;
  paddingScale: number;
  maxLinesMain: number;
  maxLinesSub: number;
}

export interface Slide {
  id: string;
  type: SlideType;
  content: SlideContent;
  layout: SlideLayout;
  computedStyle?: ComputedStyle;
}

export interface DeckTheme {
  bgColor: string;
  textColor: string;
}

export interface DeckSettings {
  aspectRatio: '16:9' | '4:3';
  theme: DeckTheme;
  defaultFontFamily: string;
}

export interface Deck {
  id: string;
  title: string;
  settings: DeckSettings;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionState {
  slideIndex: number;
  blackoutMode: BlackoutMode;
  updatedAt: string;
}

export interface Session {
  id: string;
  deckId: string;
  state: SessionState;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================
// WebSocket Event Types
// ==========================

export type WSEventType = 
  | 'SESSION_JOIN'
  | 'SESSION_STATE'
  | 'SET_SLIDE_INDEX'
  | 'SET_BLACKOUT'
  | 'HEARTBEAT'
  | 'ERROR';

export interface WSMessage {
  type: WSEventType;
  sessionId: string;
  payload?: unknown;
}

export interface SessionJoinPayload {
  role: 'display' | 'control';
  deck: Deck;
  state: SessionState;
}

export interface SetSlideIndexPayload {
  slideIndex: number;
}

export interface SetBlackoutPayload {
  blackoutMode: BlackoutMode;
}

export interface SessionStatePayload {
  state: SessionState;
}

// ==========================
// API Response Types
// ==========================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==========================
// Font Fitting Types
// ==========================

export interface FitTextOptions {
  containerWidth: number;
  containerHeight: number;
  text: string;
  fontFamily: string;
  minFontSize: number;
  maxFontSize: number;
  lineHeightRatio: number;
  paddingPercent: number; // 0-1, e.g., 0.1 = 10% padding
}

export interface FitTextResult {
  fontSize: number;
  lineHeight: number;
  lines: number;
}

// ==========================
// Default Values
// ==========================

export const DEFAULT_DECK_SETTINGS: DeckSettings = {
  aspectRatio: '16:9',
  theme: {
    bgColor: '#000000',
    textColor: '#FFFFFF',
  },
  defaultFontFamily: 'Noto Sans KR, Arial, sans-serif',
};

export const DEFAULT_SESSION_STATE: SessionState = {
  slideIndex: 0,
  blackoutMode: 'none',
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_COMPUTED_STYLE: ComputedStyle = {
  fontSizeMain: 72,
  fontSizeSub: 48,
  lineHeightMain: 1.3,
  lineHeightSub: 1.3,
  paddingScale: 0.1,
  maxLinesMain: 6,
  maxLinesSub: 4,
};

export const FONT_SIZE_LIMITS = {
  mainMax: 110,
  mainMin: 24,
  subMax: 64,
  subMin: 18,
};
