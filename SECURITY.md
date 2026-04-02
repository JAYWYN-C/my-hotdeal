# 🔐 Hotdeal Security Policy

## 개요

이 문서는 Hotdeal 프로젝트의 보안 정책, 취약점 보고 프로세스, 보안 모범 사례를 정의합니다.

---

## 보안 정책 개요

### 보안 원칙

1. **Zero Trust**: 모든 입력을 신뢰하지 않음
2. **최소 권한**: 필요한 최소 권한만 부여
3. **심층 방어**: 다층의 보안 메커니즘
4. **투명성**: 보안 이슈를 공개적으로 처리

### 보호 영역

- 🔒 **인증/인가**: Google OAuth, 세션 관리
- 🛡️ **API 보안**: CORS, Rate Limiting, 입력 검증
- 🌐 **프론트엔드**: XSS 방지, CSRF 토큰, CSP
- 📦 **의존성**: npm audit, 보안 업데이트
- 🔑 **비밀 관리**: .env 보호, 키 로테이션
- 📊 **모니터링**: 로깅, 알림, 감시

---

## 1. 인증 & 세션 보안

### Google OAuth 설정

**안전한 구현:**
```javascript
// ✅ Correct
const redirectUri = `${process.env.VERCEL_URL}/auth/callback`;
const state = crypto.randomBytes(32).toString('hex');
session.state = state; // 서버에 저장
```

**피해야 할 것:**
```javascript
// ❌ Wrong
const redirectUri = 'http://attacker.com/callback'; // 검증 없음
window.location = `...&state=${userId}`; // 클라이언트에서 state 생성
```

### 세션 쿠키

**보안 속성:**
- `HttpOnly` - JavaScript에서 접근 불가
- `Secure` - HTTPS만 전송
- `SameSite=Lax` - CSRF 방지
- `Max-Age` - 적절한 만료 시간

**예시:**
```
Set-Cookie: hotdeal_session=xxxxx; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800
```

---

## 2. API 보안

### CORS 정책

**허용되는 오리진:**
- localhost:3000 (개발)
- localhost:5000 (개발)
- jachwi-hotdeal.vercel.app
- hotdeal.kr, www.hotdeal.kr

**구현:**
```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'https://jachwi-hotdeal.vercel.app',
];

if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

### Rate Limiting

**정책:**
- 기본: 100 요청/분
- 인증 API: 10 요청/분
- 수집 API: 1000 요청/시간

**구현:**
```javascript
function checkRateLimit(req, maxRequests = 100, windowMs = 60000) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  // 제한 확인
  if (count > maxRequests) {
    return false;
  }
  return true;
}
```

### 입력 검증

**원칙:**
- 모든 입력을 의심
- 화이트리스트 기반 검증
- 길이 제한

**예시:**
```javascript
function isValidInput(input, options = {}) {
  const { maxLength = 1000, pattern = null } = options;
  
  if (input.length > maxLength) return false;
  if (/<script|javascript:/i.test(input)) return false;
  if (pattern && !pattern.test(input)) return false;
  
  return true;
}
```

### CSRF 방지

**메커니즘:**
- 모든 POST/PUT/DELETE 요청에 CSRF 토큰 필요
- 토큰은 세션별로 생성
- 토큰은 시간 제한

**구현:**
```javascript
const token = crypto.randomBytes(32).toString('hex');
res.setHeader('X-CSRF-Token', token);

// 검증
if (req.method !== 'GET') {
  const tokenFromRequest = req.headers['x-csrf-token'];
  if (!timingSafeEqual(token, tokenFromRequest)) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: 'CSRF token invalid' }));
    return;
  }
}
```

---

## 3. 프론트엔드 보안

### XSS 방지

**위험:**
```javascript
// ❌ Dangerous
element.innerHTML = userInput; // XSS 취약점
```

**안전:**
```javascript
// ✅ Safe
element.textContent = userInput; // 텍스트만 설정
// 또는
element.innerHTML = sanitizeHtml(userInput);
```

### Content Security Policy (CSP)

**정책:**
```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' https://apis.google.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https:;
  frame-ancestors 'none';
```

**설정 위치:**
- vercel.json (배포)
- index.html meta tag (개발)
- API 응답 헤더

### 보안 헤더

| 헤더 | 목적 | 값 |
|------|------|-----|
| `X-Content-Type-Options` | MIME 타입 스니핑 방지 | `nosniff` |
| `X-Frame-Options` | Clickjacking 방지 | `DENY` |
| `X-XSS-Protection` | XSS 필터 활성화 | `1; mode=block` |
| `Strict-Transport-Security` | HTTPS 강제 | `max-age=31536000` |
| `Referrer-Policy` | Referer 정보 제한 | `strict-origin-when-cross-origin` |

---

## 4. 의존성 보안

### npm Audit

**주기적 검사:**
```bash
# 모든 취약점 확인
npm audit

# 자동 수정 가능한 것 수정
npm audit fix

# 수정 불가능한 것 검토
npm audit fix --force
```

**CI/CD 통합:**
```yaml
- name: npm security audit
  run: npm audit --audit-level=high
```

### 보안 업데이트

**정책:**
- Critical/High: 즉시 업데이트
- Medium: 주간 검토
- Low: 월간 검토

**방법:**
```bash
# 최신 보안 패치만 설치
npm install --save-dev npm@latest
npm audit fix

# 업데이트 확인
npm outdated
```

### .npmrc 설정

**보안 설정:**
```ini
# 패키지 integrity 검사
audit=true

# 프로덕션 의존성만 설치
production=true

# 심각한 취약점에서 설치 중단
audit-level=high
```

---

## 5. 비밀 관리

### .env 파일

**보호:**
- `.env` 절대 git 커밋 금지
- 강한 파일 권한 (`600`)
- `.env.example` 템플릿 사용

**운영:**
```bash
# 월 1회 키 로테이션
# 1. 기존 키 폐기
# 2. 새 키 생성
# 3. .env 업데이트
# 4. 배포 환경 재구성
```

### API 키 저장

**규칙:**
- 환경변수로만 저장
- 소스코드에 절대 포함 금지
- 로그에 출력 금지

**예시:**
```javascript
// ✅ Correct
const apiKey = process.env.FIREBASE_API_KEY;

// ❌ Wrong
const apiKey = 'AIzaSyD2B_WMxpyU...'; // 하드코딩
console.log('API Key:', apiKey); // 로깅
```

---

## 6. 취약점 보고

### 보고 프로세스

취약점을 발견한 경우:

1. **공개하지 말 것** - 공개 이슈를 사용하지 말 것
2. **이메일 보고** - security@example.com 으로 보고
3. **상세 정보 제공**:
   - 취약점 유형
   - 영향 범위
   - 재현 단계
   - 제안 해결책

### 응답 시간

| 심각도 | 목표 응답 시간 |
|--------|-------------|
| Critical | 24시간 |
| High | 72시간 |
| Medium | 1주일 |
| Low | 2주일 |

---

## 7. 로깅 & 모니터링

### 로그할 이벤트

- 실패한 로그인 시도
- API 요청 오류
- Rate limit 초과
- 이상한 활동 (SQL injection 패턴 등)
- 권한 변경

### 로그할 금지 항목

- API 키, 토큰
- 사용자 비밀번호
- 신용카드 정보
- 개인 식별 정보 (PII)

**예시:**
```javascript
// ✅ Safe logging
console.log('User login failed', {
  email: 'user@example.com',
  timestamp: new Date(),
  ip: req.ip,
});

// ❌ Unsafe logging
console.log('Login failed', { ...req.body }); // 비밀번호 로깅 가능
console.log('API Key:', process.env.API_KEY); // 키 로깅
```

---

## 8. 배포 보안

### 환경별 설정

**개발:**
- HTTPS 선택사항
- CORS localhost 허용
- 상세한 에러 메시지

**프로덕션:**
- HTTPS 필수 (HSTS)
- CORS 엄격한 필터링
- 일반적인 에러 메시지
- 모니터링 활성화

### Vercel 배포

```bash
# 환경변수 설정
vercel env add FIREBASE_API_KEY

# 보안 헤더 확인
# vercel.json에 정의됨

# 배포
vercel --prod
```

---

## 9. 정기 보안 감시

### 주간 체크리스트

- [ ] npm audit 실행
- [ ] 새 보안 공시 확인
- [ ] 에러 로그 검토

### 월간 체크리스트

- [ ] 의존성 업그레이드 검토
- [ ] API 사용량 리포트 확인
- [ ] 접근 로그 감시

### 분기별 체크리스트

- [ ] API 키 로테이션
- [ ] 보안 모니터링 정책 검토
- [ ] 취약점 스캔 실행

---

## 10. 보안 체크리스트

배포 전 확인:

- [ ] 모든 입력이 검증됨
- [ ] CSRF 토큰 구현됨
- [ ] CORS 정책 설정됨
- [ ] Rate limiting 활성화됨
- [ ] 보안 헤더 설정됨
- [ ] .env 파일 gitignore됨
- [ ] API 키 환경변수화됨
- [ ] npm audit 통과
- [ ] XSS 방지 활성화됨
- [ ] 에러 메시지 일반화됨
- [ ] HTTPS 강제됨
- [ ] 로깅에 비밀정보 없음

---

## 긴급 연락처

보안 이슈: security@hotdeal.kr

---

**마지막 업데이트:** 2026-04-02  
**버전:** 1.0
