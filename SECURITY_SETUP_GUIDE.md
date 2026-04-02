# 🔐 Hotdeal 보안 설정 가이드

이 가이드는 Hotdeal 프로젝트에서 민감한 정보를 안전하게 관리하고, 보안 침해를 방지하기 위한 단계별 설정 절차입니다.

**목차:**
- [1. 초기 설정 (필수)](#1-초기-설정-필수)
- [2. Git Hooks 설치](#2-git-hooks-설치)
- [3. .env 파일 관리](#3-env-파일-관리)
- [4. IDE 설정](#4-ide-설정)
- [5. CI/CD 설정](#5-cicd-설정)
- [6. 검증 및 테스트](#6-검증-및-테스트)
- [7. 월별 감사](#7-월별-감사)

---

## 1. 초기 설정 (필수)

### 1.1 프로젝트 클론 후 첫 번째 단계

```bash
# 1. 프로젝트 클론
git clone https://github.com/JAYWYN-C/my-hotdeal.git
cd hotdeal

# 2. dependencies 설치
npm install

# 3. 환경 변수 파일 생성
cp .env.example .env

# 4. .env 파일 권한 설정 (소유자만 읽기/쓰기)
chmod 600 .env

# 5. Git hooks 설치
npm run security:setup-hooks
# 또는 수동 설치:
# bash scripts/setup-hooks.sh
```

### 1.2 API 키 입력

`.env` 파일을 텍스트 에디터로 열고 다음 정보를 입력하세요:

```bash
# VSCode에서 (터미널에서 `code` 명령 사용 안 함)
open -a "Visual Studio Code" .env

# 또는 일반 에디터
nano .env
```

**필수 입력 항목:**
- `FIREBASE_API_KEY` - Firebase 콘솔에서 복사
- `FIREBASE_PROJECT_ID` - Firebase 프로젝트 ID
- `FIREBASE_AUTH_DOMAIN` - Firebase Auth 도메인
- `VERCEL_TOKEN` - Vercel 개인 토큰 (선택사항)
- `GITHUB_TOKEN` - GitHub 개인 액세스 토큰 (선택사항)

**⚠️ 주의:**
- `.env` 파일을 Slack, 이메일, 또는 다른 사람과 공유하지 마세요
- Git에 커밋하지 마세요 (이미 `.gitignore`에 등록됨)
- 콘솔에 출력하지 마세요

---

## 2. Git Hooks 설치

### 2.1 자동 설치

```bash
npm run security:setup-hooks
```

**설치되는 것:**
- `✅ .git/hooks/pre-commit` - 커밋 전 비밀 스캔
- `✅ .git/hooks/pre-push` - 푸시 전 검증

### 2.2 설치 확인

```bash
# 두 파일 모두 실행 가능한지 확인
ls -la .git/hooks/pre-commit .git/hooks/pre-push

# 출력 예시:
# -rwxr-xr-x  pre-commit
# -rwxr-xr-x  pre-push
```

### 2.3 Hook 수동 테스트

**Pre-commit hook 테스트:**
```bash
# .env 파일을 커밋 시도 (실패해야 함)
git add .env
git commit -m "test"

# 예상 출력:
# 🔒 Security Check: Scanning for secrets...
# ❌ BLOCKED: The following .env files are staged for commit:
#    .env
# To fix: git rm --cached .env
```

**Pre-push hook 테스트:**
```bash
# pre-push는 실제 푸시 시에만 작동합니다
# (테스트는 안전하게 생략 가능)
```

---

## 3. .env 파일 관리

### 3.1 파일 위치 및 권한

```bash
# 프로젝트의 최상위 디렉토리에 위치
hotdeal/
├── .env                # ← 여기! (절대 Git에 커밋하면 안 됨)
├── .env.example        # ← 이것은 Git에 포함됨 (템플릿)
├── .gitignore
└── ...
```

**권한 확인:**
```bash
stat .env | grep Access

# 예시 (정상):
# Access: (0600/-rw-------)  Uid: ( 1000/   user)   Gid: ( 1000/ group)
```

### 3.2 API 키 추가 위치별 가이드

#### Firebase 설정

1. [Firebase 콘솔](https://console.firebase.google.com) 접속
2. 프로젝트 선택
3. ⚙️ 설정 → 프로젝트 설정
4. "일반" 탭 → 앱 섹션 → 웹 앱 선택
5. 하단의 구성 코드에서 다음 값들을 복사:

```javascript
// Firebase 콘솔 구성
const firebaseConfig = {
  apiKey: "AIzaSy..." // ← FIREBASE_API_KEY
  authDomain: "myproject.firebaseapp.com", // ← FIREBASE_AUTH_DOMAIN
  projectId: "myproject", // ← FIREBASE_PROJECT_ID
  storageBucket: "myproject.appspot.com", // ← FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789", // ← FIREBASE_MESSAGING_SENDER_ID
  appId: "1:123456789:web:abc..." // ← FIREBASE_APP_ID
};
```

#### Vercel 설정 (선택사항)

1. [Vercel 계정](https://vercel.com/account/tokens) 접속
2. "Create" 버튼 클릭 → "New Personal Token"
3. Token name: "Hotdeal Deploy"
4. Expiration: 90 days (정기적으로 갱신)
5. 생성된 토큰을 `.env`의 `VERCEL_TOKEN`에 붙여넣기

### 3.3 .env 파일 보안 체크리스트

매달 확인:
- [ ] `.env` 파일이 `.gitignore`에 있는가?
- [ ] 파일 권한이 `600`으로 설정되어 있는가? (`chmod 600 .env`)
- [ ] API 키가 정기적으로 갱신되는가? (매 60-90일)
- [ ] 어떤 사람이나 시스템과도 공유되지 않았는가?
- [ ] `.env` 키가 언급된 슬랙 메시지/이메일을 삭제했는가?

---

## 4. IDE 설정

### 4.1 VSCode 설정

`.vscode/settings.json` 파일에 다음을 추가:

```json
{
  "files.exclude": {
    ".env": true,
    ".env.*": true,
    "**/credentials.json": true,
    "**/*secret*": true,
    "**/*Secret*": true
  },
  "search.exclude": {
    ".env": true,
    ".env.*": true,
    "**/credentials.json": true,
    "**/*secret*": true
  },
  "editor.exclude": {
    ".env": true,
    ".env.*": true
  }
}
```

**효과:**
- Explorer에서 `.env` 파일이 숨김 처리됨
- Search에서 `.env` 파일 제외됨
- 실수로 열릴 확률 감소

### 4.2 다른 IDE

| IDE | 설정 방법 |
|-----|---------|
| **IntelliJ IDEA** | Settings → Editor → File Types → "Ignored Files and Folders"에 `.env` 추가 |
| **Sublime Text** | Preferences → Settings → `folder_exclude_patterns`에 `.env` 추가 |
| **Vim/Nano** | 설정 불필요 (수동으로 열지 않는 한) |

---

## 5. CI/CD 설정

### 5.1 GitHub Actions (자동 배포)

GitHub Secrets에 환경 변수를 저장합니다 (.env 파일이 아님):

**GitHub에서:**
1. Repository → Settings → Secrets and variables → Actions
2. "New repository secret" 클릭
3. Name: `FIREBASE_API_KEY`
4. Value: (실제 API 키 붙여넣기)
5. "Add secret" 클릭

**필요한 secrets:**
```
FIREBASE_API_KEY
FIREBASE_PROJECT_ID
FIREBASE_AUTH_DOMAIN
VERCEL_TOKEN (선택)
GITHUB_TOKEN (선택)
```

**Workflow 파일에서 사용:**
```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm test
        env:
          FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
```

**⚠️ 절대 금지:**
```yaml
# ❌ NEVER
- run: echo $FIREBASE_API_KEY  # Secret이 로그에 노출됨!
```

### 5.2 Vercel 배포

Vercel에서 환경 변수를 설정합니다:

1. [Vercel Dashboard](https://vercel.com/dashboard)
2. Hotdeal 프로젝트 선택
3. Settings → Environment Variables
4. "Add New" 클릭
5. 각 환경(Production, Preview, Development)에 추가

**예:**
```
FIREBASE_API_KEY = AIzaSy...
FIREBASE_PROJECT_ID = my-project
```

---

## 6. 검증 및 테스트

### 6.1 보안 스캔 실행

```bash
# 의존성 취약점 확인
npm audit

# 커밋 전 비밀 스캔 (수동)
npm run security:check-secrets

# 모든 보안 체크 실행
npm run security:all
```

### 6.2 .env 파일 누출 여부 확인

```bash
# 1. Git 커밋 히스토리에서 .env 검색
git log --all --full-history -p .env

# 결과가 없으면 정상 (아무것도 출력되지 않음)

# 2. 쉬운 방법: (너무 많은 출력 피하기)
git log --oneline | grep -i env && echo "WARNING: .env in history" || echo "OK"

# 3. Grep으로 하드코딩된 키 검색
grep -r "FIREBASE_API_KEY\|VERCEL_TOKEN\|sk_" --include="*.js" --include="*.json" . | grep -v ".env" | grep -v ".env.example"

# 출력이 없으면 정상
```

### 6.3 Pre-commit Hook 작동 테스트

```bash
# 1. 일반 파일 커밋 (성공해야 함)
echo "test" > test.txt
git add test.txt
git commit -m "test commit"
# ✅ 성공

# 2. .env 파일 커밋 시도 (실패해야 함)
git add .env
git commit -m "add env"
# ❌ BLOCKED: .env files are staged for commit

# 3. 정리
git rm --cached test.txt
rm test.txt
```

---

## 7. 월별 감사

### 7.1 월별 체크리스트 (매월 1일)

```bash
# Date: 2026-05-01 (매월)

# 1. API 키 상태 확인
# [ ] FIREBASE_API_KEY는 여전히 유효한가?
# [ ] Token이 만료되지 않았는가?

# 2. Git 히스토리 검사
git log --all --full-history -p .env | head -20
# 출력 없음 = ✅ OK

# 3. 보안 스캔
npm audit
# 0 vulnerabilities = ✅ OK

# 4. Hook 상태 확인
ls -la .git/hooks/pre-*
# 모두 실행 가능 (-rwx...) = ✅ OK

# 5. .gitignore 확인
grep -E "^\.env" .gitignore
# .env 포함되어야 함

# 6. 접근 로그 검토
# [ ] 비정상적인 파일 접근 시도가 있었나?
# [ ] 실패한 인증 시도가 많았나?
```

### 7.2 분기별 갱신 (3개월마다)

```bash
# 1. 모든 API 키 갱신
## Firebase: 새 키 발급
## Vercel: 새 토큰 생성
## GitHub: 새 Personal access token 생성

# 2. 로그 검토
# [ ] 의심스러운 로그인 시도
# [ ] Rate limit 위반
# [ ] 실패한 권한 확인 (403 errors)

# 3. 의존성 업데이트
npm update
npm audit fix

# 4. 팀 교육
# [ ] 새로운 팀원에게 보안 가이드 공유
# [ ] .env 관리 교육
```

### 7.3 연간 감사 (1년에 한 번)

```bash
# 1. 전체 보안 평가
# [ ] SECURITY_STANDARDS.md 검토
# [ ] 모든 API 키 순환
# [ ] 모든 Git hooks 재검증

# 2. 침해 사고 검토
# [ ] 금년도 보안 사건 분석
# [ ] 개선 계획 수립

# 3. 규정 준수 확인
# [ ] CLAUDE.md 준수
# [ ] SECURITY_STANDARDS.md 준수
# [ ] permissions/.env.permissions 준수

# 4. 랩업
# [ ] 감사 결과 문서화
# [ ] 팀에 공유
# [ ] 개선 사항 적용
```

---

## 🚨 긴급: API 키의 노출된 경우

### 즉시 대응

```bash
# 1. 해당 서비스에서 키 비활성화
#    - Firebase 콘솔에서 키 삭제
#    - Vercel에서 토큰 삭제
#    - GitHub에서 Personal access token 삭제

# 2. 새 키 발급
#    - 위의 "API 키 추가" 섹션 참고

# 3. .env 파일 업데이트
chmod 600 .env
nano .env
# 새로운 API 키들을 입력

# 4. 환경 변수 배포
#    - GitHub Secrets 업데이트
#    - Vercel Environment Variables 업데이트

# 5. 처리 기록
echo "[$(date)] API keys compromised and rotated" >> SECURITY_AUDIT.log
```

### Git 히스토리에서 제거 (만약 커밋되었다면)

```bash
# ⚠️ 매우 주의 (프로젝트 히스토리 수정)

# 1. BFG 설치 (또는 git filter-branch 사용)
brew install bfg

# 2. API 키가 포함된 파일 제거
bfg --delete-files .env

# 3. 강제 푸시
git push --force-with-lease

# 4. 모든 팀원에게 알림
# "피해야 할 커밋이 있습니다. 히스토리 기반 브랜치를 새로 만들어주세요"
```

---

## 📞 지원 및 문의

문제가 발생하면:

1. **`.env`파일을 읽을 수 없음:**
   ```bash
   chmod 600 .env
   ```

2. **Pre-commit hook이 작동하지 않음:**
   ```bash
   npm run security:setup-hooks
   bash scripts/setup-hooks.sh
   ```

3. **API 키 오류 (Invalid Project ID, etc.):**
   - .env.example과 비교
   - Firebase/Vercel 콘솔에서 값 재확인
   - 올바른 프로젝트를 선택했는지 확인

4. **CI/CD 배포 실패:**
   - GitHub Secrets 또는 Vercel Environment Variables 확인
   - 값이 완전히 복사되었는지 확인
   - 키에 공백이 없는지 확인

---

**마지막 업데이트:** 2026-04-02
**담당:** Hotdeal Security Team
