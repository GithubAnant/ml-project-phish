# PhishGuard demo URLs

Use these with the web app, API (`POST /predict`), or Chrome extension. **Do not** visit unknown live phishing URLs on production machines unless isolated.

## Crafted lookalikes (synthetic strings)

```
http://paypa1-secure-login.example.test/verify?user=you
https://accounts.g00gle.com.signin.example.test/oauth
http://192.168.0.1/login?redirect=http://evil.test
https://totally-legit-bank.example.test/secure/update/account
http://customer-support@fake-bank.example.test/confirm
https://sub1.sub2.sub3.sub4.phish-lookalike.example.test/path
```

## Google Safe Browsing test URLs (benign test vectors)

From [testsafebrowsing.appspot.com](https://testsafebrowsing.appspot.com/):

```
https://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/MALWARE/URL/
https://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/SOCIAL_ENGINEERING/URL/
https://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/UNWANTED_SOFTWARE/URL/
https://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/POTENTIALLY_HARMFUL_APPLICATION/URL/
```

These pages are **Google-provided test endpoints**, not real attacks, but may trigger other security tools.

## Sample phishing-labeled URLs from PhiUSIIL (plain text)

Subset copied for offline demo — hostnames may be defunct; treat as untrusted strings:

```
http://raspberriespi.ddns.net:8081/Login
http://raspberriespi.ddns.net:8081/Login?session=abc
http://raspberriespi.ddns.net:8081/Login?redirect=1
```

## Local demo HTML (safe)

Open files under `demo/pages/` via `file://` or a static server — they mimic phishing **copy only** and do not exfiltrate data:

- `demo/pages/fake_bank_login.html`
- `demo/pages/fake_paypal_notice.html`
- `demo/pages/fake_google_verify.html`
