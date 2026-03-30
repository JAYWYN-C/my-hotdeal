# Source Onboarding Checklist

법적 리스크를 줄이기 위한 소스 온보딩 점검표입니다.

## 공통 원칙
- 공개 RSS, 공식 API, 또는 접근 제한 없는 공개 목록 페이지만 사용
- 로그인/우회/강제 수집 금지
- robots.txt 및 이용약관 위반 금지
- 원문 전문 저장 금지(목록 메타 + 내부 요약 + 원문 링크 중심)
- 허용 도메인 화이트리스트 필수

## 점검 절차
1. 공식 문서 확인
- RSS/API 또는 공개 목록 제공 여부
- 상업적 재사용 가능 여부
- 요청 제한(rate limit) 기준

2. 정책 확인
- robots.txt 허용 범위
- ToS(서비스 약관) 자동 수집 허용 여부
- 저작권/상표권 리스크 여부

3. 기술 검증
- feedUrl, listUrl, 또는 API endpoint 정상 응답(200)
- title/link/pubDate와 가능하면 platform/price/shipping/sourceCategory 파싱 가능
- 링크가 allowedDomains 내에 포함되는지 확인

4. 운영 검증
- 3시간 주기 수집에서 장애율 확인
- compliance 필드에서 source 상태 점검
- 데이터 품질(핫딜 관련성, 카테고리, 플랫폼 표기) 샘플 리뷰

## 쇼핑몰 후보 운영표

| 소스 | 공식 RSS/API 확인 | robots/약관 확인 | enabled 전환 | 비고 |
|---|---|---|---|---|
| 11번가 | 미확인 | 미확인 | false 유지 | 공식 채널 확인 전 수집 금지 |
| G마켓 | 미확인 | 미확인 | false 유지 | 공식 채널 확인 전 수집 금지 |
| 옥션 | 미확인 | 미확인 | false 유지 | 공식 채널 확인 전 수집 금지 |
| SSG | 미확인 | 미확인 | false 유지 | 공식 채널 확인 전 수집 금지 |
| 컬리 | 미확인 | 미확인 | false 유지 | 공식 채널 확인 전 수집 금지 |

## 실제 활성화 방법
1. [config/sources.json](config/sources.json)에 `feedUrl` 또는 `listUrl`을 실제 공개 주소로 등록
2. `allowedDomains`를 실제 원문 도메인으로 확정
3. 필요한 경우 `collector`, `boardId`, `channel`, `titlePrefixes`를 설정
4. `enabled`를 `true`로 변경
5. 로컬에서 `node scripts/collect-deals.mjs` 실행
6. [data/deals.json](data/deals.json)의 `compliance` 상태가 `ok`인지 확인

## 실패 시 대응
- HTTP 403/429: 요청 빈도 감소 또는 해당 소스 비활성화
- HTTP 404: 공식 피드 주소 변경 여부 확인
- 딜 품질 저하: 제목 정규화 규칙/키워드 필터/카테고리 규칙/플랫폼 추정 규칙 조정
