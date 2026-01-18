# ⛪ 교회 프레젠테이션 앱 (Church Presentation App)

웹 기반 교회 예배용 프레젠테이션 제작 및 송출 시스템입니다.

## 주요 기능

- 📝 **웹 에디터**: 브라우저에서 슬라이드 제작/편집
- 📺 **듀얼 스크린**: Display(송출용) + Control(운영자용) 분리
- ⚡ **실시간 동기화**: WebSocket을 통한 즉각적인 화면 제어
- 🔤 **자동 폰트 크기**: 텍스트 양에 맞춰 자동으로 폰트 크기 조절
- 🌐 **한/영 동시 표시**: 성경/가사를 한국어와 영어로 동시 표시
- 📥 **PPTX 내보내기**: PowerPoint 파일로 다운로드 가능
- ⏱️ **예배 타이머**: 경과 시간 측정

## 기술 스택

- **Frontend**: Next.js 15 (App Router), TypeScript, React 19
- **Backend**: Next.js API Routes, WebSocket Server (Express + ws)
- **Database**: SQLite + Prisma ORM
- **Export**: pptxgenjs

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 데이터베이스 설정

```bash
# Prisma 클라이언트 생성 (이미 마이그레이션 완료됨)
npm run db:generate

# 새로 시작하는 경우 마이그레이션
npm run db:migrate
```

### 3. 개발 서버 실행

```bash
# Next.js + WebSocket 서버 동시 실행
npm run dev
```

서버가 시작되면:
- **웹 앱**: http://localhost:3000
- **WebSocket 서버**: ws://localhost:3001

### 4. 프로덕션 빌드

```bash
npm run build
npm run start

# 별도로 WebSocket 서버도 실행해야 합니다
npm run start:ws
```

## 사용 방법

### 1. 프레젠테이션 만들기

1. http://localhost:3000 접속
2. "새 프레젠테이션 만들기" 클릭
3. 슬라이드 추가 (제목/성경/가사/이미지)
4. 내용 편집 및 저장 (자동 저장)

### 2. 프레젠테이션 송출 (듀얼 스크린)

1. 에디터에서 "▶ 프레젠테이션 시작" 클릭
2. Control Screen이 열립니다
3. "📺 Display 열기" 버튼으로 Display 화면을 새 창에서 엽니다
4. **Display 창을 프로젝터/TV가 연결된 모니터로 이동** (전체 화면 권장)
5. Control Screen에서 조작하면 Display가 실시간으로 동기화됩니다

### 3. 단축키 (Control Screen)

| 키 | 동작 |
|---|---|
| `→` / `Space` / `Enter` | 다음 슬라이드 |
| `←` | 이전 슬라이드 |
| `B` | 블랙아웃 (검은 화면) |
| `W` | 화이트아웃 (흰 화면) |
| `Home` | 첫 슬라이드로 |
| `End` | 마지막 슬라이드로 |

### 4. PPTX 내보내기

- 에디터에서 "📥 PPTX 다운로드" 클릭
- 홈 화면에서 각 프레젠테이션의 📥 버튼 클릭

## 슬라이드 유형

### 제목 (Title)
- 큰 제목 텍스트
- 예배 제목, 순서 안내 등에 사용

### 성경 (Bible)
- 한국어/영어/한영 동시 표시 모드
- 구절 참조(Reference) 표시 가능

### 가사 (Lyrics)
- 찬양 가사 표시
- 한국어/영어/한영 동시 표시 모드

### 이미지+텍스트 (ImageText)
- 배경 이미지 위에 텍스트 오버레이

## 자동 폰트 크기 규칙

교회 환경의 **가독성**을 우선으로 설계되었습니다:

- **최대 크기 제한**: Main 110px, Sub 64px
- **최소 크기 보장**: Main 24px, Sub 18px
- **안전 여백**: 화면의 10% 패딩
- **한영 분할 비율**: 한국어 55%, 영어 35%, 간격 10%
- **서브 폰트 비율**: 메인 폰트의 0.7~0.85배

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── decks/        # Deck CRUD + PPTX Export
│   │   └── sessions/     # Session 관리
│   ├── editor/[deckId]/  # 슬라이드 에디터
│   ├── present/[sessionId]/
│   │   ├── display/      # 송출 화면 (Display)
│   │   └── control/      # 운영자 화면 (Control)
│   ├── globals.css       # 전역 스타일
│   ├── layout.tsx
│   └── page.tsx          # 홈페이지
├── components/
│   └── SlideRenderer.tsx # 슬라이드 렌더링 컴포넌트
├── hooks/
│   └── useWebSocket.ts   # WebSocket 클라이언트 훅
├── lib/
│   ├── font-fitting.ts   # 폰트 피팅 알고리즘
│   └── prisma.ts         # Prisma 클라이언트
├── server/
│   └── ws-server.ts      # WebSocket 서버
├── types/
│   └── index.ts          # TypeScript 타입 정의
└── __tests__/
    ├── font-fitting.test.ts
    └── session-state.test.ts
```

## API 엔드포인트

### Decks
- `GET /api/decks` - 목록 조회
- `POST /api/decks` - 생성
- `GET /api/decks/[deckId]` - 조회
- `PUT /api/decks/[deckId]` - 수정
- `DELETE /api/decks/[deckId]` - 삭제
- `GET /api/decks/[deckId]/export/pptx` - PPTX 다운로드

### Sessions
- `POST /api/sessions` - 세션 생성
- `GET /api/sessions/[sessionId]` - 세션 조회 (Deck 포함)
- `PATCH /api/sessions/[sessionId]` - 상태 업데이트

## 테스트

```bash
# 테스트 실행
npm run test

# 한 번만 실행
npm run test:run
```

## 설정 (가정사항)

다음 사항들은 합리적으로 가정하여 구현되었습니다:

1. **폰트**: Noto Sans KR을 기본으로 사용, 없으면 Arial로 대체
2. **화면 비율**: 16:9 기본 (4:3 옵션 가능)
3. **배경색**: 검정(#000000) 기본 - 가독성 최적화
4. **글자색**: 흰색(#FFFFFF) 기본
5. **WebSocket 재연결**: 3초마다 자동 재연결 시도
6. **자동 저장**: 편집 후 1초 디바운스

## 트러블슈팅

### WebSocket 연결 안됨
1. WS 서버가 실행 중인지 확인: `npm run dev:ws`
2. 포트 3001이 사용 중인지 확인
3. 방화벽 설정 확인

### Display가 동기화 안됨
1. 브라우저 콘솔에서 WebSocket 연결 상태 확인
2. Control과 Display가 같은 sessionId를 사용하는지 확인

### 폰트가 이상하게 보임
1. 브라우저에서 Noto Sans KR이 로드되었는지 확인
2. 네트워크 연결 상태 확인 (Google Fonts)

## 라이선스

MIT
