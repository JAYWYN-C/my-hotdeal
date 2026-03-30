# hotdeal

정적 웹 + GitHub Actions 기반 핫딜 서비스입니다.

## 링크
- 서비스: https://jaywyn-c.github.io/my-hotdeal/
- 저장소: https://github.com/JAYWYN-C/my-hotdeal

## 핵심 기능
- 3개 카테고리: 게임/전자기기, 음식/식품, 모바일 금액권/할인권
- 자동 수집 데이터 표시: `data/deals.json`
- 뽐뿌/아카라이브 같은 공개 핫딜 목록 페이지 기준 자동 수집
- 제목 정규화: `[제품명] (할인내용 / 사이트)` 형식으로 통일 노출
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
- 현재 활성 소스: 뽐뿌, 해외뽐뿌, 알리뽐뿌
- 아카라이브는 2026-03-30 기준 공개 목록 페이지가 `HTTP 403`이라 대체 엔드포인트 확인 전까지 비활성화

## 배포
- 워크플로: `.github/workflows/deploy-pages.yml`
- `main` 푸시 시 자동 배포

## 커스텀 도메인(선택)
- 현재는 기본 Pages 주소(`jaywyn-c.github.io/my-hotdeal`) 사용
- 나중에 본인 도메인이 생기면 `CNAME` 파일 추가 후 연결

## Firebase 설정
1. `firebase-config.example.js`를 복사해 `firebase-config.js` 생성
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
