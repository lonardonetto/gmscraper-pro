# Security Enhancements for Live Server

## Critical Issues to Fix

### 1. Admin Secret Protection
- Move admin secret to environment variables
- Rotate admin secret regularly
- Use API keys instead of simple secrets
- Implement IP whitelisting for admin endpoints

### 2. Rate Limiting
```javascript
// Add rate limiting middleware
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### 3. Database Security
- Move database outside web root
- Implement proper database encryption
- Add database connection limits

### 4. Input Validation
```javascript
// Enhanced validation
const validateLicenseKey = (key) => {
  // Strict regex validation
  const pattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;
  return pattern.test(key);
};
```

### 5. Security Headers
```javascript
// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 6. Monitoring & Logging
- Implement security event logging
- Add intrusion detection
- Monitor for unusual patterns
- Set up alerts for security events

### 7. API Security
- Implement API versioning
- Add request signing
- Use JWT tokens for authentication
- Implement proper CORS policies

## Immediate Actions Required

1. **Change Admin Secret**: Generate a new, complex secret
2. **Add Rate Limiting**: Prevent brute force attacks
3. **Secure Database**: Move database to secure location
4. **Enable Logging**: Monitor all API calls
5. **Add Monitoring**: Set up security alerts

## Risk Assessment

- **Current Risk Level**: MEDIUM-HIGH
- **Primary Concerns**: Admin secret exposure, lack of rate limiting
- **Recommended Action**: Implement critical security fixes immediately

## Testing Commands to Run

```bash
# Test rate limiting
for i in {1..200}; do curl -s https://testing.crmpk.com/api/license/validate -X POST -H "Content-Type: application/json" -d '{"licenseKey":"TEST","machineId":"test"}'; done

# Test admin endpoint security
curl -s https://testing.crmpk.com/api/admin/licenses -H "X-Admin-Secret:15619619618961689196198ad98s41ad96asd96asda"

# Test various attack vectors
curl -s https://testing.crmpk.com/api/license/validate -X POST -H "Content-Type: application/json" -d '{"licenseKey":"../../../etc/passwd","machineId":"test"}'
```
