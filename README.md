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
# Prisma 클라이언트 생성
npm run db:generate

# 로컬 연결 설정 및 기존 마이그레이션 적용
npm run db:setup
```

`npm run dev` 또는 `npm run dev:next` 실행 시에도 DB 설정을 자동으로 준비합니다.
`DATABASE_URL`이 없으면 `.env`에 `DATABASE_URL="file:../dev.db"`를 추가하여
프로젝트 루트의 `dev.db`를 사용합니다. 기존 설정과 데이터는 유지합니다.
직접 설정하려면 `.env.example`을 `.env`로 복사하고 연결 경로를 수정하세요.

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
3. 슬라이드 추가 (제목/성경/가사/이미지). 찬양·성경은 사이드바 **일괄 입력**에 빈 줄로 절을 구분해 붙여넣으면 여러 장이 됩니다.
4. 내용 편집 및 저장 (자동 저장). 홈에서 **복제**하거나 **송출**로 바로 시작할 수 있습니다.

### 2. 프레젠테이션 송출 (듀얼 스크린)

1. 에디터에서 "▶ 프레젠테이션 시작" 클릭
2. 현재 창은 Control 화면으로 이동하고, Display 송출 창이 자동으로 열립니다.
3. 지원 브라우저에서 모니터 관리 권한을 허용하면 운영 화면과 다른 모니터에 Display 창을 배치합니다. Windows 디스플레이 설정은 **확장** 모드로 설정하세요.
4. 자동 배치가 지원되지 않거나 권한을 거부한 경우 Display 창을 직접 옮겨 주세요. 자동 전체 화면이 차단되면 송출 창의 **⛶ 전체 화면** 버튼을 누르세요. 팝업이 차단되거나 창을 닫은 경우 **📺 Display 열기**로 재시도할 수 있습니다. 내장 브라우저에서 창이 열리지 않으면 Chrome 또는 Edge에서 앱 주소를 여세요.
5. Control Screen에서 조작하면 Display가 실시간으로 동기화됩니다. 운영 메모에 다음 순서·기도자를 적어 둘 수 있습니다.
6. 송출 창이 전체 화면으로 시작하지 않으면 Control의 **⛶ 송출 전체 화면**을 누르세요. 운영 화면의 클릭을 송출 창에 넘겨 전체 화면으로 전환합니다(Chrome/Edge). 전체 화면이 되면 버튼이 **🗗 송출 창 모드**로 바뀌어 창 모드로 되돌릴 수 있고, 송출 창에서 `Esc`나 `F11`을 눌러도 버튼 상태가 따라갑니다.
7. 예배가 끝나면 Control의 **■ 송출 종료**를 누르세요. 송출 창을 닫고 세션을 정리한 뒤 편집 화면으로 돌아갑니다.

### 3. 단축키 (Control Screen)

| 키 | 동작 |
|---|---|
| `→` / `Space` / `Enter` | 다음 슬라이드 |
| `←` | 이전 슬라이드 |
| `B` | 검정 화면 |
| `W` | 흰색 화면 |
| `Esc` | 화면 가림 해제 |
| `Home` | 첫 슬라이드로 |
| `End` | 마지막 슬라이드로 |

### 4. PPTX 내보내기

- 에디터에서 "📥 PPTX 다운로드" 클릭
- 홈 화면에서 각 프레젠테이션의 PPTX 버튼 클릭

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
