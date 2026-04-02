# 🔐 Hotdeal 보안 표준 및 가이드라인

이 문서는 Hotdeal 프로젝트의 모든 개발 활동에 적용되는 보안 표준, 제한 사항, 그리고 구현 가이드를 정의합니다.

---

## 📋 목차

1. [환경 변수 & 비밀 관리](#1-환경-변수--비밀-관리)
2. [의존성 관리](#2-의존성-관리critical)
3. [민감한 로깅 금지](#3-민감한-로깅-금지)
4. [인증 및 인가](#4-인증-및-인가)
5. [프론트엔드 보안](#5-프론트엔드-보안--비밀)
6. [CORS 및 보안 헤더](#6-cors-및-보안-헤더)
7. [오류 처리 & 속도 제한](#7-오류-처리--속도-제한)
8. [데이터베이스 & 저장소 보안](#8-데이터베이스--저장소-보안)
9. [Git & 버전 관리](#9-git--버전-관리)
10. [감시 및 감사](#10-감시-및-감사)

---

## 1. 환경 변수 & 비밀 관리

### 1.1 .env 파일 관리

#### ❌ 금지 사항 (FORBIDDEN)
- **직접 읽기 & 편집**: Copilot, AI 에이전트, 개발자가 `.env` 파일을 직접 접근/열기
- **VCS에 커밋**: `.env` 파일을 절대 버전 관리에 포함하지 않기
- **하드코딩**: 환경 변수를 소스코드에 직접 작성: `const key = "AIzaSy..."`
- **로깅**: `console.log(process.env.FIREBASE_API_KEY)` 절대 금지

#### ✅ 필수 조건 (REQUIRED)
- `.env` 파일은 `.gitignore`에 등록 (중복 패턴으로 안전성 강화):
  ```
  .env
  .env.local
  .env.*.local
  .env.development.local
  .env.test.local
  .env.production.local
  ```

- 모든 API 키는 환경 변수 참조로만 사용:
  ```javascript
  // ✅ Correct
  const firebaseApiKey = process.env.FIREBASE_API_KEY;
  const vercelToken = process.env.VERCEL_TOKEN;
  ```

- `.env.example`을 템플릿으로 유지 (실제 값 안 포함):
  ```bash
  # .env.example
  FIREBASE_API_KEY=your_firebase_api_key_here
  VERCEL_TOKEN=your_vercel_token_here
  ```

#### ✅ 강제 (ENFORCE)
- `.env` 파일 권한을 600으로 설정: `chmod 600 .env`
- Git pre-commit hooks로 `.env` 커밋 시도 자동 차단
- Git pre-push hooks로 원격 저장소로의 접근 방지
- 매월 API 키 및 토큰 순환 (rotation)

### 1.2 API 키 & 토큰 분류

| 분류 | 예시 | 저장 위치 | 접근 권한 |
|------|------|---------|---------|
| **비밀 (Secrets)** | Firebase key, Vercel token, GitHub token | `.env` (로컬 전용) + CI/CD secrets 환경 | Owner only |
| **개인 (Private)** | 사용자 세션 ID, auth tokens | 메모리 + HttpOnly 쿠키 | Auth middleware |
| **공개 (Public)** | API base URL, feature flags | `.env.example`, `config/` 디렉토리 | 누구나 |

---

## 2. 의존성 관리 (CRITICAL)

### ❌ 금지 사항 (FORBIDDEN)
- **승인 없는 설치**: `npm install`, `pip install`, `gem install` 등을 무단으로 진행
- **external 패키지 권장**: 사용자 승인 없이 새로운 라이브러리 추천
- **라이선스 무시**: GPL, AGPL 등 라이선스 확인 없이 도입

### ✅ 필수 절차 (REQUIRED)
새로운 의존성이 필요할 때:
1. **필요성 설명**: 왜 필요한가? 현재 솔루션과 비교
2. **라이선스 확인**: MIT/Apache 2.0/BSD 등 클라우드 호환 라이선스만
3. **보안 검토**: `npm audit` 결과 및 CVE 확인
4. **사용자 승인 대기**: 진행하기 전에 명시적 승인 필요
5. **문서화**: `package.json`과 `README.md`에 사유 기록

### ✅ 현재 승인된 의존성
```json
{
  "@upstash/redis": "^1.37.0",      // Redis client
  "@vercel/functions": "^2.2.12"    // Vercel serverless
}
```

---

## 3. 민감한 로깅 금지

### ❌ 금지 사항 (FORBIDDEN)
- API 키, 토큰, 비밀번호 로깅:
  ```javascript
  // ❌ NEVER
  console.log(`API Key: ${process.env.FIREBASE_API_KEY}`);
  logger.info(`Auth token: ${authToken}`);
  ```

- 개인정보 (PII) 로깅:
  ```javascript
  // ❌ NEVER
  console.log(`User email: ${user.email}`);
  console.log(`Full request: ${JSON.stringify(req.body)}`);
  ```

- 세션 ID, 쿠키 내용:
  ```javascript
  // ❌ NEVER
  console.log(`Session: ${sessionId}`);
  console.log(`Cookie: ${req.headers.cookie}`);
  ```

### ✅ 올바른 로깅 (CORRECT)

마스크 처리와 함께 필요한 정보만:
```javascript
// ✅ Mask sensitive data
function maskSecret(secret) {
  if (!secret) return '****';
  return secret.slice(0, 4) + '****';
}

console.log(`API Key initialized: ${maskSecret(process.env.FIREBASE_API_KEY)}`);
logger.info(`Auth attempt for user (masked)`); // 이메일 제외
console.log(`Request method: ${req.method}, status: ${res.statusCode}`); // 결과만
```

### ✅ 감사 로깅 (AUDIT LOGGING)
보안 관련 이벤트는 로깅 필수:
```javascript
// ✅ DO log security events (without sensitive data)
logger.warn({
  event: 'failed_auth',
  timestamp: new Date().toISOString(),
  ip: req.ip,
  reason: 'invalid_password', // not the password itself
});

logger.info({
  event: 'api_call',
  endpoint: '/api/deals',
  method: 'GET',
  status: 200,
  duration_ms: 45,
});
```

---

## 4. 인증 및 인가

### ❌ 금지 사항 (FORBIDDEN)
- **모의 인증**: 테스트용 백도어, 하드코딩된 비밀번호
  ```javascript
  // ❌ NEVER
  if (email === 'test@example.com' && password === 'password123') {
    return { authenticated: true }; // TEST BACKDOOR!
  }
  ```

- **임시 우회**: 프로덕션에서 인증 스킵
  ```javascript
  // ❌ NEVER
  const isAdmin = process.env.NODE_ENV === 'test' ? true : checkAdmin(); // BYPASS!
  ```

- **평문 비밀번호**: 데이터베이스에 암호화 없이 저장
  ```javascript
  // ❌ NEVER
  db.users.insert({ email, password: plainPassword }); // PLAIN TEXT!
  ```

### ✅ 프로덕션 수준 구현 (REQUIRED)

**비밀번호 해싱:**
```javascript
// ✅ Use bcrypt with cost factor >= 12
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(plainPassword, 12);
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

**세션 관리:**
```javascript
// ✅ Secure session cookies
res.setHeader('Set-Cookie', [
  `session=${sessionToken}`,
  'Path=/',
  'HttpOnly',           // 자바스크립트 접근 불가
  'Secure',             // HTTPS만
  'SameSite=Lax',       // CSRF 방지
  'Max-Age=604800'      // 7일
].join('; '));
```

**테스팅:**
- 실제 인증 플로우를 그대로 유지하되, test doubles 사용:
  ```javascript
  // ✅ Use test doubles that maintain security contract
  class MockAuthService {
    async authenticate(email, password) {
      // Still validates input, still hashes password
      // Just uses in-memory storage instead of database
      return { userId, token: generateToken() };
    }
  }
  ```

---

## 5. 프론트엔드 보안 & 비밀

### ❌ 금지 사항 (FORBIDDEN)
- **클라이언트 측 하드코딩**: 모든 민감한 정보는 프론트엔드에 절대 노출되면 안 됨
  ```javascript
  // ❌ NEVER put in client-side code
  const FIREBASE_API_KEY = "AIzaSyDx..."; // EXPOSED TO BROWSER!
  const STRIPE_SECRET = "sk_live_..."; // EXPOSED!
  ```

- **비밀 설정 공개**:
  ```html
  <!-- ❌ NEVER -->
  <meta name="firebase-key" content="AIzaSyDx...">
  <script>const AUTH_SECRET = "my-app-secret";</script>
  ```

### ✅ 안전한 구현 (REQUIRED)

**공개 변수만 프론트엔드에 노출:**
```javascript
// ✅ Only expose public variables with explicit prefix
// .env file
VITE_PUBLIC_API_BASE_URL=https://api.example.com
VITE_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...

// JavaScript
const apiBase = import.meta.env.VITE_PUBLIC_API_BASE_URL;
const stripeKey = import.meta.env.VITE_PUBLIC_STRIPE_PUBLIC_KEY;
```

**모든 민감한 작업은 백엔드 API를 통해:**
```javascript
// ❌ WRONG: Directly access Firebase from client
firebase.auth().createUserWithEmailAndPassword(email, password);

// ✅ CORRECT: Use backend API
const response = await fetch('/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
  credentials: 'include'
});
```

**백엔드는 항상 검증:**
```javascript
// ✅ Backend validates all requests (NEVER TRUST FRONTEND)
app.post('/api/deals/save', (req, res) => {
  // 1. 인증 확인
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  // 2. 인가 확인
  if (!(await canUserModifyDeal(req.user.id, req.body.dealId))) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  // 3. 데이터 검증
  if (!isValidDealData(req.body)) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  
  // 4. 실행
  await saveDeal(req.body);
  res.json({ ok: true });
});
```

---

## 6. CORS 및 보안 헤더

### ❌ 금지 사항 (FORBIDDEN)

**와일드카드 CORS - 절대 안 됨:**
```javascript
// ❌ NEVER in production
app.use(cors({ origin: '*' })); // SECURITY HOLE!
res.setHeader('Access-Control-Allow-Origin', '*');
```

### ✅ 안전한 CORS 정책 (REQUIRED)

**정확한 오리진 지정:**
```javascript
const allowedOrigins = [
  'https://jachwi-hotdeal.vercel.app',
  'https://hotdeal.kr',
  'https://www.hotdeal.kr',
  // 개발 환경만
  ...(process.env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://localhost:5000']
    : [])
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // 쿠키 포함
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### ✅ 보안 헤더 (REQUIRED)

```javascript
// 모든 응답에 보안 헤더 추가
app.use((req, res, next) => {
  // XSS 방지
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // HTTPS 강제
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // 참조 정책
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (XSS 방지)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
  );
  
  next();
});
```

---

## 7. 오류 처리 & 속도 제한

### ❌ 금지 사항 (FORBIDDEN)

**Happy Path 만 구현:**
```javascript
// ❌ NEVER: No error handling
async function fetchDeals() {
  const response = await fetch('https://api.example.com/deals');
  return response.json(); // No try-catch, no timeout!
}
```

**스택 트레이스 노출:**
```javascript
// ❌ NEVER: Expose internal errors
app.get('/api/deals', (req, res) => {
  try {
    const deals = loadDeals();
    res.json(deals);
  } catch (e) {
    res.status(500).json({ error: e.stack }); // EXPOSES SERVER PATH!
  }
});
```

### ✅ 견고한 오류 처리 (REQUIRED)

**타임아웃 & 재시도:**
```javascript
// ✅ With timeout and exponential backoff
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 seconds
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (response.ok) return response.json();
    } catch (error) {
      const delay = Math.pow(2, i) * 100; // 100ms, 200ms, 400ms
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error('Failed to fetch after retries');
}
```

**안전한 오류 응답:**
```javascript
// ✅ Generic error messages, no stack traces
app.get('/api/deals', async (req, res) => {
  try {
    const deals = await loadDeals();
    res.json(deals);
  } catch (error) {
    // Log for debugging (without sensitive data)
    logger.error({
      event: 'deals_loading_failed',
      error: error.message, // NOT error.stack
      timestamp: new Date().toISOString()
    });
    
    // Return generic message to client
    res.status(500).json({ 
      error: 'Unable to load deals. Please try again later.' 
    });
  }
});
```

### ✅ 속도 제한 (RATE LIMITING)

```javascript
// ✅ Rate limiting per IP/user
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,      // 1 minute
  max: 100,                       // 100 requests per window
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || req.ip;
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 minutes
  max: 10,                        // 10 failed attempts
  message: 'Too many login attempts'
});

app.get('/api/deals', apiLimiter, handleDeals);
app.post('/api/auth/login', authLimiter, handleLogin);
```

---

## 8. 데이터베이스 & 저장소 보안

### ❌ 금지 사항 (FORBIDDEN)

**평문 비밀번호:**
```javascript
// ❌ NEVER
db.users.insert({
  email: 'user@example.com',
  password: 'myPassword123' // PLAIN TEXT!
});
```

**직접 SQL 쿼리 (SQL Injection):**
```javascript
// ❌ NEVER
const query = `SELECT * FROM users WHERE email = '${email}'`; // VULNERABLE!
db.query(query);
```

### ✅ 안전한 구현 (REQUIRED)

**비밀번호 해싱:**
```javascript
// ✅ Use bcrypt (cost >= 12) or Argon2
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(plainPassword, 12);
db.users.insert({ email, password: hashedPassword });
```

**매개변수화된 쿼리:**
```javascript
// ✅ Use parameterized queries
const result = await db.query(
  'SELECT * FROM users WHERE email = ?',
  [email]
);

// Or with Firestore
db.collection('users').where('email', '==', email).limit(1);
```

**Firestore 보안 규칙:**
```javascript
// ✅ Enforce row-level access control
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자는 자신의 데이터에만 접근 가능
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // 거래 데이터는 인증된 사용자만 읽기 가능
    match /deals/{dealId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.isAdmin == true;
    }
  }
}
```

---

## 9. Git & 버전 관리

### ❌ 금지 사항 (FORBIDDEN)
- `.env` 파일을 커밋
- `*credentials*.json`, `*secret*.json` 파일들
- 하드코딩 API 키
- 개인 키 파일

### ✅ git hooks 자동 차단 (REQUIRED)

프로젝트가 다음 .git hooks로 보호됨:

1. **Pre-commit hook**: 커밋 전 비밀 스캔
   ```bash
   bash scripts/check-secrets.sh
   ```

2. **Pre-push hook**: 푸시 전 `.env` 파일 검증
   ```bash
   bash scripts/check-push.sh
   ```

**설정:**
```bash
# 한 번만 실행
npm run security:setup-hooks

# 또는 수동
bash scripts/setup-hooks.sh
```

**우회 방법 (권장하지 않음):**
```bash
git commit --no-verify     # (매우 위험)
git push --no-verify        # (절대 금지)
```

### ✅ 파일 권한 (REQUIRED)
```bash
# .env 파일은 소유자만 읽기/쓰기 가능
chmod 600 .env

# hooks는 실행 가능하게
chmod +x .git/hooks/*
```

---

## 10. 감시 및 감사

### ✅ 보안 이벤트 로깅 (REQUIRED)

**인증:**
```
[2026-04-02 10:15:30] AUTH_SUCCESS: user=john@example.com, ip=192.168.1.1
[2026-04-02 10:16:05] AUTH_FAILED: email=attacker@test.com, reason=invalid_password, ip=203.0.113.50
[2026-04-02 10:16:06] AUTH_FAILED: email=attacker@test.com, reason=invalid_password, ip=203.0.113.50
[2026-04-02 10:16:07] RATE_LIMITED: ip=203.0.113.50, endpoint=/api/auth/login
```

**API 접근:**
```
[2026-04-02 10:20:15] API_CALL: user=john (id=123), endpoint=/api/deals, method=GET, status=200, duration=45ms
[2026-04-02 10:20:20] API_ERROR: endpoint=/api/deals/update, user=john, error=permission_denied
```

**`.env` 접근 시도:**
```
[2026-04-02 08:45:00] ENV_ACCESS_DENIED: process=python-script, file=.env
[2026-04-02 08:45:01] ENV_ACCESS_DENIED: process=grep, file=.env
```

### ✅ 월별 감사 (REQUIRED)

1. **API 키 순환**: 모든 환경 변수 재발급
2. **접근 로그 검토**: 비정상 접근 패턴 확인
3. **실패한 인증 분석**: 비정상 로그인 시도 검토
4. **의존성 업데이트**: `npm audit` 실행 및 취약점 패치
5. **보안 헤더 검증**: 모든 엔드포인트 테스트

### ✅ 알림 (REQUIRED)

다음 이벤트 발생 시 즉시 알림:
- 5분 내 3회 이상 실패한 인증
- 속도 제한 위반
- `.env` 커밋 시도 (git hook 차단)
- 런타임 권한 오류
- 데이터베이스 쿼리 실패 (반복)

---

## 📊 규정 준수 체크리스트

### Phase 1: .env & 비밀 관리
- [ ] `.env` 파일이 `.gitignore`에 등록됨 (중복 패턴)
- [ ] 모든 API 키가 `process.env.VARIABLE_NAME` 사용
- [ ] 소스코드에 하드코딩된 비밀 없음
- [ ] 모든 팀원이 `.env.example` 템플릿 사용
- [ ] `.env` 파일 권한이 600으로 설정
- [ ] `.env.permissions` 정책 파일 검토됨

### Phase 2: Git & 버전 관리
- [ ] Pre-commit hook 설치 및 테스트됨
- [ ] Pre-push hook 설치 및 테스트됨
- [ ] `npm run security:setup-hooks` 실행됨
- [ ] `scripts/check-secrets.sh` 정상 작동
- [ ] `scripts/check-push.sh` 정상 작동

### Phase 3: 의존성 & 보안
- [ ] 모든 의존성이 승인 목록에 있음
- [ ] `npm audit` 결과가 0 취약점
- [ ] Mock 인증/백도어 없음
- [ ] 모든 API 호출에 타임아웃/재시도 있음

### Phase 4: API & 프론트엔드
- [ ] CORS는 와일드카드 사용하지 않음
- [ ] 모든 오리진이 정확히 지정됨
- [ ] 보안 헤더 구현됨 (CSP, HSTS, X-Frame-Options)
- [ ] 프론트엔드에 하드코딩 비밀 없음
- [ ] 모든 민감한 작업은 백엔드 API를 통함

### Phase 5: 로깅 & 감시
- [ ] 민감한 정보(키, 토큰, PII) 로그에 없음
- [ ] 비밀은 마스크 처리(_마스킹됨_ 또는 ****로 표시)
- [ ] 오류 메시지에 스택 트레이스 없음
- [ ] 속도 제한 구현됨 (IP/사용자 별)
- [ ] 보안 이벤트 감사 로그 유지 중

---

## 🚨 보안 침해 대응 절차

### 1. API 키 노출 감지 시
```bash
# 즉시 수행
1. git log --all --grep="<key>" # 모든 커밋 검색
2. AWS/Firebase 콘솔에서 키 비활성화
3. 새 키 발급
4. 팀 알림
5. .env 파일 업데이트
6. 감사 로그 기록
```

### 2. 비정상 로그인 시도
```bash
# 조사
1. IP 주소 지역 확인
2. 실패 패턴 분석
3. 해당 IP 차단 고려
4. 영향받은 사용자에게 알림
```

### 3. 데이터베이스 오류
```bash
# 즉시 조치
1. 서비스 중단 (필요시)
2. 로그 검색 (SQL Injection 가능성)
3. 백업에서 복구
4. 관리자에게 보고
```

---

## 📚 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Secure Coding Guidelines](https://www.securecoding.cert.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)

---

**마지막 업데이트:** 2026-04-02
**작성자:** Hotdeal Security Team
**검토 주기:** 월별 보안 감사 시 검토
