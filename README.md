# 자취핫딜.zip

정적 웹 + GitHub Actions 기반 자취생 절약 대시보드입니다.

## 링크
- 서비스: https://jaywyn-c.github.io/my-hotdeal/
- 저장소: https://github.com/JAYWYN-C/my-hotdeal

## 핵심 기능
- 자취생용 카테고리: 전체, 야채·과일, 냉동식품, 디저트, 기타 식품, 생활용품, 청소용품, 여행, 상품권, 게임, 전자기기, 해외핫딜, 할인페스타
- 자동 수집 데이터 표시: `data/deals.json`
- 공개 핫딜 커뮤니티 목록 페이지 기준 자동 수집
- 제목 정규화: `[플랫폼] 상품명`
- 카드/상세 태그는 `카테고리 / 플랫폼 / 출처` 값을 그대로 표시
- 상세 보기에서 `구매하러 가기`와 `원본글 보러가기`를 함께 제공
- 검색/정렬/소스 필터/스크랩
- 브라우저 알림

## 실행
1. 브라우저에서 `index.html` 열기
2. 또는 Live Server로 실행

## 자동 수집
- 워크플로: `.github/workflows/collect-deals.yml`
- 주기: 1시간마다
- 수동 실행: `node scripts/collect-deals.mjs`
- 소스 설정: `config/sources.json`
- 현재 활성 소스: 뽐뿌, 해외뽐뿌, 알리뽐뿌, FM코리아, 개드립, 루리웹, 딜바다 국내, 딜바다 해외, 쿨엔조이
- 2026-03-30 기준 비활성 소스: 퀘이사존(`HTTP 403`), 아카라이브(`Cloudflare challenge 403`), 클리앙(`HTTP 403`)

## 배포
- 현재 운영 주소: `https://jaywyn-c.github.io/my-hotdeal/`
- 수동 배포: 푸시하면 GitHub Pages 워크플로가 자동 배포
- GitHub Pages 워크플로: `.github/workflows/deploy-pages.yml`

## Firebase 설정
1. `firebase-config.js`는 현재 사용하지 않습니다.
2. 로그인이나 외부 계정 연동 없이 바로 실행됩니다.

## 운영 문서
- 법적/수집 정책: [LEGAL_SOURCES.md](LEGAL_SOURCES.md)
- 소스 온보딩: [SOURCE_ONBOARDING_CHECKLIST.md](SOURCE_ONBOARDING_CHECKLIST.md)
