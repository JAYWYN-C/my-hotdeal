# hotdeal

비용 0원으로 시작 가능한 핫딜 사이트 MVP(정적 웹)입니다.

## 실행 방법
1. 브라우저로 `index.html`을 직접 열기
2. 또는 VS Code Live Server 확장으로 실행

## 현재 구현 범위
- 3개 카테고리 탭: 게임/전자기기, 음식/식품, 모바일 금액권/할인권
- 회사 행사 정보는 태그(`eventTags`)로 노출
- 소스 필터: 수집된 소스를 동적으로 표시
- 검색/정렬/스크랩(로컬스토리지 저장)
- `data/deals.json` 자동 로드(실패 시 내장 샘플 폴백)
- Google 로그인/로그아웃
- 키워드 알림(브라우저 알림 API + 로컬 키워드 저장)
- 로그인 사용자 기준 Firestore 동기화(스크랩/알림 키워드)

## 자동 수집(무료)
- 수집 스크립트: `scripts/collect-deals.mjs`
- 출력 파일: `data/deals.json`
- 소스 설정: `config/sources.json`
- 정책 문서: `LEGAL_SOURCES.md`
- 온보딩 체크리스트: `SOURCE_ONBOARDING_CHECKLIST.md`
- GitHub Actions: `.github/workflows/collect-deals.yml`
- 스케줄: 3시간마다 자동 실행(수동 실행도 가능)

로컬 수집 실행:
1. `node scripts/collect-deals.mjs`

로컬 알림 테스트:
1. 사이트에서 `브라우저 알림 권한 요청` 버튼 클릭
2. 키워드 입력 후 `추가`
3. `키워드 알림 켜기` 버튼으로 활성화

참고:
- 이 프로젝트는 RSS/공개 피드만 수집하는 `rss-only` 모드로 동작
- 링크 도메인 화이트리스트를 통과한 항목만 반영
- 딜 키워드 필터를 통과한 항목만 반영
- 인터넷 쇼핑몰 참고 소스(11번가/G마켓/옥션/SSG/컬리)는 기본 비활성화 상태
- 위 쇼핑몰은 공식 RSS/API 확인 후 `enabled: true`로 전환해서 사용
- 서비스 운영 전 반드시 robots.txt/이용약관/저작권 정책 확인 필요

## 무료 배포 방법
1. GitHub Pages
- 저장소 생성 후 파일 업로드
- `main` 브랜치 push 시 `.github/workflows/deploy-pages.yml`로 자동 배포
- 정적 파일이라 별도 서버 비용 없음(0원)

### 커스텀 도메인 연결 (아이디 노출 제거)
- 이 저장소는 [CNAME](CNAME)에 `hotdeal.kr`가 설정되어 있음
- 배포 완료 후 최종 주소를 `https://hotdeal.kr`로 사용 가능

DNS 설정(도메인 관리 업체에서 설정):
1. 루트 도메인(`@`) A 레코드
- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`
2. `www` CNAME 레코드
- `www` -> `<GitHub아이디>.github.io`

GitHub 저장소 설정:
1. Settings > Pages > Custom domain에 `hotdeal.kr` 확인
2. Enforce HTTPS 활성화

참고:
- 다른 도메인을 쓸 경우 [CNAME](CNAME) 값을 해당 도메인으로 변경
- DNS 전파까지 수분~최대 24시간 소요 가능

2. Cloudflare Pages
- GitHub 저장소 연결
- Build 설정 없이 정적 파일 배포
- CDN 기본 제공

## Google 로그인(무료로 붙이는 방법)
1. Firebase Auth(무료 티어)에서 Google Provider 활성화
2. `firebase-config.example.js`를 복사해서 `firebase-config.js` 생성
3. `firebase-config.js`에 Firebase Web SDK 키 입력
4. Firestore Database 생성(Production 또는 Test)
5. 로그인 성공 시 스크랩/알림 설정을 사용자별로 클라우드 동기화

현재 레포는 Google 로그인/로그아웃 UI와 연동 코드까지 포함되어 있으며, `firebase-config.js`에 키를 넣으면 동작합니다.

예시:
```js
window.FIREBASE_CONFIG = {
	apiKey: "...",
	authDomain: "...",
	projectId: "...",
	appId: "..."
};
```

권장 Firestore 규칙:
```txt
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /userPreferences/{userId} {
			allow read, write: if request.auth != null && request.auth.uid == userId;
		}
	}
}
```

## 다음 단계(백엔드 없이 가능한 확장)
- 키워드 알림 조건 저장 UI + 브라우저 알림 API
- 피드 소스 추가(아카라이브/네이버 카페 실제 피드 또는 허용된 API)

## 합법 수집 운영 팁
1. 새 소스 추가 시 `config/sources.json`에만 등록하고, 비공개/로그인 필요한 페이지는 제외
2. 원문 전문 저장 대신 현재처럼 제목/메타/원문 링크 방식 유지
3. 소스별 이슈는 `data/deals.json`의 `compliance` 필드로 점검

## 다음 단계(실제 서비스용)
- Google OAuth + 회원 DB
- 크롤러/수집 파이프라인
- 알림 엔진(이메일/푸시)
