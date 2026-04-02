# 🔐 Hotdeal 보안 문서 인덱스

**작성일:** 2026-04-02  
**상태:** ✅ 완료  
**담당:** Hotdeal Security Team

---

## 빠른 링크

### 🚀 처음 시작하는 개발자
1. **[SECURITY_SETUP_GUIDE.md](SECURITY_SETUP_GUIDE.md)** - 필독! 초기 설정 가이드 (5분)
   - .env 파일 생성 및 API 키 입력
   - Git hooks 설치
   - IDE 설정

### 📋 정책 & 표준
2. **[CLAUDE.md](CLAUDE.md)** - AI 에이전트 & 개발자 보안 규칙
   - .env 직접 접근 금지
   - 8개 추가 보안 표준
   - 규정 준수 체크리스트

3. **[SECURITY_STANDARDS.md](SECURITY_STANDARDS.md)** - 종합 보안 가이드라인
   - 10개 보안 주제 (환경 변수, 의존성, 로깅, 인증, CORS, 등)
   - 금지 사항 (❌) / 필수 조건 (✅) / 강제 사항 (✅)
   - 코드 예시 포함

### 🛰️ 인프라 & 배포
4. **[permissions/.env.permissions](permissions/.env.permissions)** - 접근 통제 정책
   - Deny/Allow 규칙 명시
   - 7개 구현 레이어
   - 규정 준수 체크리스트

### 🔧 모니터링 & 감사
5. **[.env.example](.env.example)** - API 키 템플릿
   - 모든 환경 변수 설명
   - Firebase, Vercel, GitHub 설정
   - 보안 규칙 요약

---

## 📂 보안 설정 파일

### Git Hooks (자동 차단)
```
scripts/
├── check-secrets.sh      📋 Pre-commit: 비밀 스캔
├── check-push.sh         📋 Pre-push: .env 검증  
└── setup-hooks.sh        🔧 Hook 자동 설치
```

### 환경 설정
```
/
├── .env                  🔒 민감한 정보 (절대 커밋 금지)
├── .env.example          📝 템플릿 (Git에 포함)
├── .gitignore            🚫 .env 무시 설정
└── package.json          📦 보안 npm 스크립트
```

### 권한 관리
```
permissions/
└── .env.permissions      🔐 접근 통제 정책 문서
```

---

## 🎯 주요 보안 기능

| 기능 | 파일 | 설명 |
|------|------|------|
| **Git Hook 차단** | scripts/check-secrets.sh | 커밋 전 비밀 스캔 ✅ |
| **Pre-push 검증** | scripts/check-push.sh | 푸시 전 .env 검증 ✅ |
| **API 키 관리** | .env.example | 안전한 템플릿 ✅ |
| **접근 정책** | permissions/.env.permissions | 상세한 권한 규칙 ✅ |
| **표준 & 규칙** | CLAUSE.md, SECURITY_STANDARDS.md | 포괄적 가이드 ✅ |

---

## 📅 자주 하는 작업

### 처음 설정하기
```bash
npm install
cp .env.example .env
chmod 600 .env
npm run security:setup-hooks
# 이제 .env에 API 키 입력
```

### 월별 감사
```bash
# .env.example/SECURITY_SETUP_GUIDE.md의 "7.1 월별 체크리스트" 참고
```

### 어서 시작하기
1. [SECURITY_SETUP_GUIDE.md](SECURITY_SETUP_GUIDE.md) - 1부 초기 설정 읽기
2. 2단계: .env 파일에 API 키 입력
3. 3단계: `git commit` 해보기 (Hook 테스트)

---

## 🚨 긴급 문제

### "❌ BLOCKED: .env files are staged for commit"
```bash
# 해결책
git rm --cached .env
git commit -m "remove .env"
```

### "API 키 실수로 노출됨"
[SECURITY_SETUP_GUIDE.md](SECURITY_SETUP_GUIDE.md) - "7. 긴급: API 키의 노출된 경우" 섹션 참고

### Git hooks 작동하지 않음
```bash
npm run security:setup-hooks
```

---

## 📖 읽기 순서

### 보안 담당자 (처음 읽기)
1. ← **이 파일** (현재 위치)
2. CLAUDE.md - 직접 접근 금지 규칙이해
3. SECURITY_STANDARDS.md - 종합 표준
4. permissions/.env.permissions - 정책 세부사항

### 개발자 (처음 읽기)
1. SECURITY_SETUP_GUIDE.md - 초기 설정 (필독!)
2. .env.example - API 키 템플릿 (설정 시)
3. CLAUDE.md - 규칙 이해

### DevOps/배포 담당 (처음 읽기)
1. SECURITY_SETUP_GUIDE.md - "5. CI/CD 설정" 섹션
2. CLAUDE.md - 보안 규칙 검토
3. SECURITY_STANDARDS.md - 배포 보안

---

## ✅ 보안 체크리스트

### 프로젝트 셋업
- [ ] npm install 실행
- [ ] .env.example 복사 → .env
- [ ] chmod 600 .env 실행
- [ ] npm run security:setup-hooks 실행
- [ ] .env에 API 키 입력

### Git 설정
- [ ] Pre-commit hook 설치 확인
- [ ] Pre-push hook 설치 확인
- [ ] .gitignore에 .env 포함
- [ ] IDE에서 .env 숨김 설정 (VSCode)

### CI/CD 설정
- [ ] GitHub Secrets 설정
- [ ] Vercel Environment Variables 설정
- [ ] 배포 스크립트 검증

### 월별 감사
- [ ] npm audit 실행
- [ ] API 키 상태 확인
- [ ] Git 히스토리 검사
- [ ] 접근 로그 검토

---

## 🔗 관련 문서

| 문서 | 대상 | 목적 |
|------|------|------|
| CLAUDE.md | 개발자, AI | 보안 규칙 |
| SECURITY.md | 보안 담당 | 보안 정책 |
| SECURITY_STANDARDS.md | 개발자, 리더 | 상세 표준 |
| SECURITY_SETUP_GUIDE.md | 개발자 | 설정 가이드 |
| permissions/.env.permissions | 관리자 | 접근 정책 |
| .env.example | 개발자 | 템플릿 |

---

## 📞 질문 & 지원

- **초기 설정:** [SECURITY_SETUP_GUIDE.md](SECURITY_SETUP_GUIDE.md) - "1. 초기 설정" 섹션
- **보안 규칙:** [CLAUDE.md](CLAUDE.md) 또는 [SECURITY_STANDARDS.md](SECURITY_STANDARDS.md)
- **Git hooks:** `npm run security:setup-hooks`
- **API 키 문제:** [SECURITY_SETUP_GUIDE.md](SECURITY_SETUP_GUIDE.md) - "6. 검증 및 테스트" 섹션

---

## 🎓 학습 경로

### 5분 요약
→ [.env.example](.env.example) 스캔

### 15분 필수 학습
→ [SECURITY_SETUP_GUIDE.md](SECURITY_SETUP_GUIDE.md) - "1. 초기 설정" 섹션

### 30분 심화 학습
→ [CLAUDE.md](CLAUDE.md) 전체 읽기

### 1시간 전문가 학습
→ [SECURITY_STANDARDS.md](SECURITY_STANDARDS.md) 전체 읽기

### 2시간 마스터 수준
→ 모든 문서 + [permissions/.env.permissions](permissions/.env.permissions)

---

**마지막 업데이트:** 2026-04-02

**🟢 상태:** 모든 보안 설정 완료 & 문서화 완료

→ **[SECURITY_SETUP_GUIDE.md로 이동 (초기 설정)](SECURITY_SETUP_GUIDE.md)**
