# 자취핫딜.zip

정적 웹 + GitHub Actions 기반 자취생 절약 대시보드입니다.

## 링크
- 서비스: https://jachwi-hotdeal.vercel.app/
- 저장소: https://github.com/JAYWYN-C/my-hotdeal
- 기존 GitHub Pages 주소: https://jaywyn-c.github.io/my-hotdeal/

## 핵심 기능
- 자취생용 카테고리: 전체, 야채·과일, 냉동식품, 디저트, 기타 식품, 생활용품, 청소용품, 여행, 상품권, 게임, 전자기기, 해외핫딜, 할인페스타
- 자동 수집 데이터 표시: `data/deals.json`
- 공개 핫딜 커뮤니티 목록 페이지 기준 자동 수집
- 제목 정규화: `[플랫폼] 상품명`
- 카드/상세 태그는 `카테고리 / 플랫폼 / 출처` 값을 그대로 표시
- 상세 보기에서 `구매하러 가기`와 `원본글 보러가기`를 함께 제공
- 검색/정렬/소스 필터/스크랩
- Google 로그인 + Firestore 사용자 설정 동기화
- 키워드 메일 알림 + 브라우저 알림

## 실행
1. 브라우저에서 `index.html` 열기
2. 또는 Live Server로 실행

## 자동 수집
- 워크플로: `.github/workflows/collect-deals.yml`
- 주기: 1시간마다
- 수동 실행: `node scripts/collect-deals.mjs`
- 알림 발송: `node scripts/send-keyword-alerts.mjs --previous /tmp/previous-deals.json --current data/deals.json`
- 변경 감지 시 Vercel 프로덕션도 다시 배포
- 소스 설정: `config/sources.json`
- 현재 활성 소스: 뽐뿌, 해외뽐뿌, 알리뽐뿌, FM코리아, 개드립, 루리웹, 딜바다 국내, 딜바다 해외, 쿨엔조이
- 2026-03-30 기준 비활성 소스: 퀘이사존(`HTTP 403`), 아카라이브(`Cloudflare challenge 403`), 클리앙(`HTTP 403`)

## 배포
- 현재 운영 주소: `https://jachwi-hotdeal.vercel.app/`
- 수동 배포: `npx --yes vercel deploy --prod`
- GitHub Pages 워크플로: `.github/workflows/deploy-pages.yml`
- GitHub 저장소 자동 연결은 아직 미완료
  - Vercel 계정에 GitHub Login Connection을 추가해야 `my-hotdeal` 저장소와 자동 배포 연결 가능

## 커스텀 도메인(선택)
- 현재는 Vercel 기본 주소(`jachwi-hotdeal.vercel.app`) 사용
- 나중에 본인 도메인이 생기면 Vercel Domains에서 연결 가능

## Firebase 설정
1. `firebase-config.js`에 실제 Firebase 설정값 입력
2. Firebase Auth(Google) 활성화
3. Firestore 생성
4. `userPreferences/{uid}` 문서에 `alertKeywords`, `emailAlertsEnabled`, `email` 필드가 저장되도록 로그인 흐름 사용
5. Firebase Console > Authentication > Settings > Authorized domains에 `jaywyn-c.github.io`와 `localhost` 추가
6. Vercel 주소를 쓸 경우 `jachwi-hotdeal.vercel.app`도 Authorized domains에 추가

### 로그인 연결 서비스(API)
- 클라이언트는 Firebase 로그인 후 `/api/auth-session`으로 세션 동기화
- `firebase-config.js`가 비어 있어도 `/api/firebase-config`에서 런타임 설정을 읽어 로그인 가능

Vercel 환경변수(필수):
1. `NEXT_PUBLIC_FIREBASE_API_KEY`
2. `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
3. `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
4. `NEXT_PUBLIC_FIREBASE_APP_ID`

설정 명령 예시:
```bash
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production
npx vercel --prod --yes
```

예시:
```js
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  appId: "..."
};
```

GitHub Pages 배포용 저장소 변수:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

## GitHub Actions 시크릿
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`
- `VERCEL_TOKEN`

수집 워크플로는 새 딜을 만든 뒤 Firestore 구독 문서와 비교해서, 로그인한 Google 메일 주소로 키워드 매칭 메일을 즉시 발송합니다.

## 운영 문서
- 법적/수집 정책: [LEGAL_SOURCES.md](LEGAL_SOURCES.md)
- 소스 온보딩: [SOURCE_ONBOARDING_CHECKLIST.md](SOURCE_ONBOARDING_CHECKLIST.md)
