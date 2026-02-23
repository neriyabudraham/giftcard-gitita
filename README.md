# שוברי מתנה - שפת המדבר

מערכת מלאה לניהול ומכירת שוברי מתנה עבור משתלת "שפת המדבר" ועגלת הקפה "גיתיתה".

## תכונות

- **אתר רכישת שוברים** - ממשק משתמש יפה לרכישת שוברים
- **בדיקת יתרת שובר** - דף ציבורי לבדיקת יתרה בשובר
- **מערכת ניהול** - פאנל אדמין מאובטח לניהול שוברים ומשתמשים
- **אימות Google OAuth** - התחברות עם חשבון Google
- **PostgreSQL** - בסיס נתונים לשמירת כל המידע
- **יצירת תמונות שובר** - שירות אוטומטי ליצירת תמונות שוברים
- **שליחת מיילים** - אישור רכישה במייל עם השובר

## מבנה הפרויקט

```
giftcard-gitita/
├── frontend/           # ממשק משתמש (Nginx + Static files)
│   ├── public/         # קבצי HTML, CSS, JS
│   └── Dockerfile
├── backend/            # API Server (Node.js/Express)
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── services/   # Business logic
│   │   └── middleware/ # Authentication
│   ├── public/admin/   # Admin panel
│   └── Dockerfile
├── docker-compose.yml
└── .env
```

## התקנה והרצה

### דרישות מקדימות
- Docker & Docker Compose
- Node.js 18+ (לפיתוח מקומי)

### הרצה מקומית

```bash
# Clone the repo
git clone https://github.com/neriyabudraham/giftcard-gitita.git
cd giftcard-gitita

# Copy and edit environment variables
cp .env.example .env
# Edit .env with your values

# Run with Docker
docker-compose up -d --build

# Access:
# - Frontend: http://localhost:3000
# - Admin: http://localhost:3000/admin/
# - API: http://localhost:3000/api/
```

### פריסה בשרת

```bash
cd /www/wwwroot/giftcard-gitita.botomat.co.il && \
git pull && \
docker-compose down && \
docker-compose up -d --build
```

## משתני סביבה

| משתנה | תיאור |
|-------|-------|
| `SMTP_HOST` | שרת SMTP (ברירת מחדל: smtp.gmail.com) |
| `SMTP_PORT` | פורט SMTP (ברירת מחדל: 587) |
| `SMTP_USER` | שם משתמש SMTP |
| `SMTP_PASS` | סיסמת SMTP |
| `SMTP_FROM` | כתובת השולח |
| `GOOGLE_CLIENT_ID` | מזהה Google OAuth |
| `GOOGLE_CLIENT_SECRET` | סוד Google OAuth |
| `GOOGLE_REDIRECT_URI` | URI לחזרה מGoogle |
| `JWT_SECRET` | מפתח סודי ל-JWT |
| `ADMIN_EMAIL` | מייל המנהל הראשי |

## API Endpoints

### ציבוריים
- `GET /api/vouchers/search?number=xxx` - חיפוש שובר
- `GET /api/vouchers/check?card=xxx` - בדיקה אם שובר פעיל (מחזיר true/false)
- `POST /api/purchase/save` - שמירת נתוני רכישה
- `GET /api/purchase/verify/:voucherId` - אימות תשלום
- `POST /api/purchase/webhook` - webhook לאישור תשלום

### מאומתים (דורשים התחברות)
- `GET /api/vouchers` - רשימת שוברים
- `POST /api/vouchers` - יצירת שובר
- `PUT /api/vouchers/:id` - עדכון שובר
- `POST /api/vouchers/:id/use` - שימוש בשובר
- `GET /api/users` - רשימת משתמשים (מנהל בלבד)
- `POST /api/users` - הוספת משתמש (מנהל בלבד)

## קונפיגורציית Nginx (שרת)

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name giftcard-gitita.botomat.co.il;

    # SSL certificates
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Proxy to Docker frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Direct API proxy (optional, for /api without frontend)
    location /api/ {
        proxy_pass http://127.0.0.1:3946/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## מנהל ראשי

בהתקנה ראשונית, המשתמש `office@neriyabudraham.co.il` נוצר כמנהל.

כניסה ראשונה:
1. גש ל `/admin/login.html`
2. התחבר עם Google או הזן את האימייל
3. צור סיסמה (פעם ראשונה בלבד)
4. לאחר יצירת סיסמה - ניתן להתחבר עם Google או אימייל+סיסמה

## רישיון

MIT
