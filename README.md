# שוברי מתנה - שפת המדבר

מערכת לרכישת והורדת שוברי מתנה דיגיטליים.

## תכונות

- בחירת סכום שובר
- מילוי פרטים וברכה אישית
- תשלום בכרטיס אשראי
- הורדה מיידית של השובר כתמונה
- שליחת השובר במייל

## מבנה הפרויקט

```
giftcard-gitita/
├── docker-compose.yml      # הגדרות Docker
├── frontend/               # קבצי Frontend
│   ├── Dockerfile
│   ├── nginx.conf
│   └── public/
│       ├── index.html      # דף ראשי
│       ├── payment.html    # דף תשלום
│       ├── thank-you.html  # דף תודה
│       ├── styles.css
│       └── *.js
└── backend/                # שרת Backend
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── index.js
        ├── routes/
        └── services/
```

## הרצה מקומית

```bash
# העתק את קובץ ההגדרות
cp .env.example .env

# ערוך את ההגדרות
nano .env

# הרץ עם Docker
docker-compose up --build
```

## פריסה בשרת

### פקודה להרמה מחדש:

```bash
cd /www/wwwroot/giftcard-gitita.botomat.co.il && git pull && docker-compose down && docker-compose up -d --build
```

## משתני סביבה

| משתנה | תיאור |
|-------|-------|
| `SMTP_HOST` | כתובת שרת SMTP |
| `SMTP_PORT` | פורט SMTP (587/465) |
| `SMTP_USER` | שם משתמש SMTP |
| `SMTP_PASS` | סיסמת SMTP |
| `SMTP_FROM` | כתובת שולח המייל |

## API Endpoints

### POST /api/purchase
יצירת רכישה חדשה

### GET /api/voucher/:voucherId/image
הורדת תמונת שובר

### GET /api/health
בדיקת תקינות השרת
