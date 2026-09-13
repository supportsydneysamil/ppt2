# 예배 운영 편의성 1차 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 예배 준비(일괄 가사 입력, 홈에서 송출/복제)와 현장 운영(메모, 한글 UI, Display 동기화)을 기존 앱 위에 더한다.

**Architecture:** 슬라이드 조작은 `src/lib/slides.ts` 순수 함수로 두고 UI는 홈/에디터/Control만 호출한다. 세션·덱 API는 그대로 쓴다. Display만 deck ref로 레이스를 막는다.

**Tech Stack:** Next.js App Router, React 19, Prisma/SQLite, Vitest, 기존 WebSocket

## Global Constraints

- 새 npm 의존성을 추가하지 않는다.
- 복사/라벨/오류 메시지는 한국어.
- 슬라이드 JSON 스키마를 깨지 않는다 (`Slide`, `DeckSettings` 필드 추가 없음).
- Display 창 배치는 기존 `prepareDisplayWindow`를 재사용한다.

---

### Task 1: 슬라이드 순수 함수와 테스트

**Files:**
- Create: `src/lib/slides.ts`
- Create: `src/__tests__/slides.test.ts`

**Interfaces:**
- Consumes: `Slide`, `SlideType`, `SlideContent`, `AlignType` from `@/types`
- Produces: `splitStanzaBlocks`, `createSlide`, `slidesFromStanzas`, `insertSlidesAfter`, `slideTypeLabel`, `slidePreviewText`, `cloneSlides`

- [ ] **Step 1: Write the failing test**

`src/__tests__/slides.test.ts`에 빈 줄 분할, 한영 개수 불일치, 삽입 인덱스, 미리보기 말줄임, 복제 시 새 id를 검증한다.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/slides.test.ts`

- [ ] **Step 3: Write `src/lib/slides.ts`**

`uuid`로 slide id를 만들고, 성경/가사는 기본 `splitMode: 'koEn'`를 유지한다.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run src/__tests__/slides.test.ts`

---

### Task 2: 에디터 — 삽입 위치, 일괄 입력, 테마, 안전장치

**Files:**
- Modify: `src/app/editor/[deckId]/page.tsx`

**Interfaces:**
- Consumes: functions from `src/lib/slides.ts`
- Produces: editor UX described in the spec

- [ ] **Step 1: `addSlide`는 `insertSlidesAfter(slides, selected, [newSlide])`를 쓴다. 선택 인덱스를 새 슬라이드로 옮긴다.**
- [ ] **Step 2: 사이드바에 가사/성경 일괄 입력(한국어·영어·성경 구절·유형 선택). 빈 입력이면 안내.**
- [ ] **Step 3: 썸네일에 유형+미리보기. 삭제 confirm. 테마 color input. `beforeunload`.**
- [ ] **Step 4: `npx vitest run` 기존 테스트 통과 확인.**

---

### Task 3: 홈 — 검색, 복제, 바로 송출

**Files:**
- Create: `src/lib/session-launch.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/editor/[deckId]/page.tsx` (start flow가 helper를 쓰도록)

**Interfaces:**
- Produces: `createPresentationSession(deckId: string): Promise<{ id: string }>`

- [ ] **Step 1: POST `/api/sessions` 래퍼 `createPresentationSession`.**
- [ ] **Step 2: 홈에 검색, 복제(POST decks + 새 slide id), Display 열고 control로 이동.**
- [ ] **Step 3: 에디터 시작도 같은 세션 생성 함수를 쓴다.**

---

### Task 4: Control + Display

**Files:**
- Modify: `src/app/present/[sessionId]/control/page.tsx`
- Modify: `src/app/present/[sessionId]/display/page.tsx`

- [ ] **Step 1: Control 한글 상태, Black/White → 검정/흰색, Esc로 해제, 다음 슬라이드 큐 텍스트.**
- [ ] **Step 2: 운영 메모 로드/디바운스 PATCH `notes`.**
- [ ] **Step 3: Display `deckRef`로 `handleStateChange`가 최신 덱을 쓰게 한다.**
- [ ] **Step 4: `npx vitest run` 전체 통과.**

---

### Task 5: README 사용법 한 줄씩 반영

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 일괄 입력, 홈 복제/송출, Control 메모와 Esc를 사용 방법에 적는다.**
