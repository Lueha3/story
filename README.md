# 꿀템 라이브러리

인스타 스토리에 올린 꿀템을 카테고리별(상의, 하의, 아우터, 신발, ACC, 기타)로 모아 보여주는 사이트예요.
인스타그램 계정에는 전혀 접속하지 않아요. 폰에 저장된 스토리 이미지를 이 사이트로 보내면,
AI가 이미지를 읽고 카테고리·상품 이름·가격을 알아서 채워요.

- `/` 방문자 화면
- `/admin` 관리 화면 (본인만): 분류 확인·수정, 링크 붙이기, 숨기기·삭제, 직접 올리기

## 어떻게 돌아가나요

1. 인스타 설정 › 보관 및 다운로드 › **카메라 롤에 스토리 저장**을 켜요. 올린 스토리가 사진첩 'Instagram' 앨범에 저장돼요.
2. 아이폰 단축어 자동화가 인스타 앱을 닫을 때 최근 사진 몇 장을 `/api/ingest`로 보내요. 이미 받은 사진은 서버가 알아서 건너뛰어요.
3. 서버가 AI로 이미지를 읽고 카테고리에 넣어요. 애매하면 '확인 필요'로 표시돼서 `/admin`에서 한 번 눌러 고치면 돼요.
4. 상품링크: 무신사 앱에서 공유 › 단축어 '링크 등록'을 누르면 `/api/links`로 가요.
   - 15분 안에 올린 스토리 중 링크 없는 것에 붙어요.
   - 그런 스토리가 없으면 기다렸다가 1시간 안에 올라오는 다음 스토리에 붙어요.
   - 틀리면 `/admin`의 '링크 없음' 목록에서 바로 고쳐요.

### 분류 기준

[`lib/classify.ts`](lib/classify.ts) 위쪽의 `SYSTEM` 글에 적혀 있어요. 지금 기준:

- 후드 집업, 가디건, 셔츠 자켓, 조끼 → 아우터
- 가방, 모자, 벨트, 양말, 주얼리 → ACC
- 그루밍, 향수, 상품 없는 공지 → 기타

## 처음 설치 (Vercel)

1. [Vercel](https://vercel.com)에 GitHub 계정으로 가입하고 이 저장소를 Import 해요.
2. 프로젝트 › Storage에서 두 가지를 만들어 프로젝트에 연결해요. 연결하면 환경변수가 자동으로 들어가요.
   - **Blob** (이미지 저장, `BLOB_READ_WRITE_TOKEN`)
   - **Neon Postgres** (기록 저장, `DATABASE_URL`)
3. 프로젝트 › Settings › Environment Variables에 직접 넣어요.

   | 이름 | 값 |
   |---|---|
   | `ADMIN_TOKEN` | 12자 이상 아무 비밀번호. 단축어와 `/admin`에서 써요. |
   | `ANTHROPIC_API_KEY` | [Claude Console](https://console.anthropic.com)에서 만든 API 키 |
   | `IG_HANDLE` | 인스타 아이디 (@ 없이) |
   | `CLASSIFY_MODEL` | 선택. 비우면 `claude-opus-5-5` |
   | `CLASSIFY_EFFORT` | 선택. `low`~`max`, 비우면 `low` |

4. Redeploy 하면 끝이에요. 표는 처음 요청이 올 때 자동으로 만들어져요.
5. `/admin`에 들어가면 맨 위 '연결 상태'에 데이터베이스, 이미지 저장소, AI 키가 모두 '연결됨'인지 나와요.
   Storage를 연결할 때 이름 앞에 붙는 글자(예: `STORAGE_`)를 바꿔도 알아서 찾아요.

> AI 사용료는 스토리 한 장마다 들어요. 기본값(Opus 5.5, 낮음)은 하루 30장에 한 달 20~25달러 정도로 예상해요(추정치).
> 더 아끼려면 `CLASSIFY_MODEL=claude-haiku-5-5`, `CLASSIFY_EFFORT=high`로 바꿔요(한 달 1~2달러, 정확도는 직접 확인 필요).

## 아이폰 단축어 2개

`https://내주소` 자리에 Vercel이 준 주소를, `비밀번호` 자리에 `ADMIN_TOKEN`을 넣어요.

### ① 스토리 보내기 (자동화)

단축어 앱 › 자동화 › 새로운 자동화 › **앱** › Instagram, **닫힐 때**, **즉시 실행**.

1. **사진 찾기**: 앨범이 `Instagram`, 정렬 '생성일' 최신순, 개수 제한 10
2. **반복 (각 항목)**:
   1. **이미지 크기 조절**: 높이 1920 (가로는 자동). Vercel은 4.5MB가 넘는 요청을 받지 않아요.
   2. **이미지 변환**: JPEG로
   3. **URL의 콘텐츠 가져오기**
      - URL `https://내주소/api/ingest`, 방법 POST
      - 헤더 `Authorization` = `Bearer 비밀번호`
      - 본문 '양식': `file` = 변환된 이미지(파일), `takenAt` = 반복 항목의 '생성일'

### ② 링크 등록 (공유 시트)

새 단축어 › 설정에서 **공유 시트에 표시** 켜기, 입력은 URL·텍스트.

1. **URL의 콘텐츠 가져오기**
   - URL `https://내주소/api/links`, 방법 POST
   - 헤더 `Authorization` = `Bearer 비밀번호`
   - 본문 '파일' = 단축어 입력
2. (선택) **알림 보기**: 결과의 `message`

무신사 상품 화면 › 공유 › '링크 등록'을 누르면 돼요.

## 직접 실행 (개발용)

```bash
npm install
ADMIN_TOKEN=test-token-123456 npm run dev
```

`DATABASE_URL`이 없으면 `.data/` 폴더에 저장해요(Vercel에서는 이렇게 동작하지 않고 연결하라는 오류를 보여줘요).
올린 사진은 서버가 긴 변 1920px JPEG로 줄여서 저장해요. `ANTHROPIC_API_KEY`가 없으면 자동 분류 없이 '분류 실패'로 들어가요.

## API

| 경로 | 누가 | 하는 일 |
|---|---|---|
| `GET /api/stories` | 누구나 | 숨기지 않은 스토리 목록 |
| `POST /api/ingest` | 본인 | 이미지 업로드(`file`, 선택 `takenAt`) → 저장·분류·링크 연결 |
| `POST /api/links` | 본인 | 상품링크 등록 |
| `GET /api/admin/stories` | 본인 | 전체 목록(숨김 포함) |
| `PATCH /api/admin/stories/:id` | 본인 | `category`, `link`, `hidden`, `itemName` 수정 |
| `DELETE /api/admin/stories/:id` | 본인 | 삭제(이미지 포함) |

본인 요청은 `Authorization: Bearer <ADMIN_TOKEN>` 헤더가 필요해요.
