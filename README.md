# hotdeal

정적 웹 + GitHub Actions 기반 핫딜 서비스입니다.

## 링크
- 서비스: https://jaywyn-c.github.io/my-hotdeal/
- 저장소: https://github.com/JAYWYN-C/my-hotdeal

## 핵심 기능
- 5개 카테고리: 전체, 식품, 전자기기, 해외핫딜, 할인 페스타
- 자동 수집 데이터 표시: `data/deals.json`
- 공개 핫딜 커뮤니티 목록 페이지 기준 자동 수집
- 제목 정규화: `[제품명] (가격 / 배송 / 플랫폼)` 중심으로 통일 노출
- 카드에서 플랫폼/출처를 분리 표기하고 `자세히 보기`에서 요약 + 원문 커뮤니티 글 연결
- 검색/정렬/소스 필터/스크랩
- 키워드 알림(브라우저 알림)
- Google 로그인 + Firestore 사용자 설정 동기화

## 실행
1. 브라우저에서 `index.html` 열기
2. 또는 Live Server로 실행

## 자동 수집
- 워크플로: `.github/workflows/collect-deals.yml`
- 주기: 3시간마다
- 수동 실행: `node scripts/collect-deals.mjs`
- 소스 설정: `config/sources.json`
- 현재 활성 소스: 뽐뿌, 해외뽐뿌, 알리뽐뿌, FM코리아, 개드립, 루리웹, 딜바다 국내, 딜바다 해외, 쿨엔조이
- 2026-03-30 기준 비활성 소스: 퀘이사존(`HTTP 403`), 아카라이브(`Cloudflare challenge 403`), 클리앙(`HTTP 403`)

## 배포
- 워크플로: `.github/workflows/deploy-pages.yml`
- `main` 푸시 시 자동 배포

## 커스텀 도메인(선택)
- 현재는 기본 Pages 주소(`jaywyn-c.github.io/my-hotdeal`) 사용
- 나중에 본인 도메인이 생기면 `CNAME` 파일 추가 후 연결

## Firebase 설정
1. `firebase-config.js`에 실제 Firebase 설정값 입력
2. Firebase Auth(Google) 활성화
3. Firestore 생성

예시:
```js
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  appId: "..."
};
```

## 운영 문서
- 법적/수집 정책: [LEGAL_SOURCES.md](LEGAL_SOURCES.md)
- 소스 온보딩: [SOURCE_ONBOARDING_CHECKLIST.md](SOURCE_ONBOARDING_CHECKLIST.md)
