# Ori Asher — Portfolio 2026

אתר תיק עבודות אינטראקטיבי בסגנון [henryheffernan.com](https://henryheffernan.com/):
חדר מינימליסטי בסגנון Apple Store בתלת־ממד (קירות לבנים, רצפת אבן, שולחן אלון עם רגליים מאלומיניום), עם **MacBook Air**, iPad, iPhone, AirPods, HomePod ועכבר Magic Mouse — לוחצים והמצלמה "נכנסת" לתוך המסך,
שם רצה סימולציה של **macOS**: תפריט עליון, Dock עם הגדלה, חלונות Finder / Safari / Notes / Mail / Terminal /
System Settings, Spotlight, Control Center, ווידג'טים וסמן עכבר של Mac.

כל הסצנה נבנית בקוד (Three.js) — אין קבצי מודלים או תמונות חיצוניים.

---

## הרצה מקומית

דרוש [Node.js](https://nodejs.org) (גרסה 18 ומעלה).

```bash
npm install
npm run dev
```

ואז לפתוח <http://localhost:5191>. כל שמירה של קובץ מתעדכנת אוטומטית (רענון ידני של הדפדפן).

## לערוך את התוכן (הכי חשוב!)

כל הטקסטים נמצאים בקובץ אחד: **`src/content.js`**

| מה | איפה בקובץ |
|---|---|
| שם, תפקיד, מיקום, שנה | `name`, `title`, `location`, `year` |
| משפט הפתיחה | `tagline` |
| "About" — פסקאות, עובדות, כישורים | `about` |
| ניסיון תעסוקתי | `experience` |
| פרויקטים (שם, תיאור, תגיות, קישור, צבע) | `projects` |
| אימייל וקישורי רשתות | `contact` |

כרגע כל הטקסטים הם **דוגמאות** — תחליפו אותם בפרטים האמיתיים של Ori.
בפרויקטים, `hue` הוא מספר 0–360 שקובע את צבע הכרטיס, ו־`url` הוא הקישור שייפתח בלחיצה.

## בנייה לפרסום

```bash
npm run build
```

נוצרת תיקייה `dist/` עם 3 קבצים (`index.html`, `app.js`, `app.css`).
אפשר להעלות אותה לכל אירוח סטטי:

- **Netlify Drop** — גוררים את התיקייה `dist` ל־<https://app.netlify.com/drop>
- **Vercel / GitHub Pages / Cloudflare Pages** — מצביעים על `dist` כתיקיית הפרסום
- כדי לבדוק מקומית בלי שרת, אפשר גם לפתוח את `dist/index.html` ישירות

## מבנה הפרויקט

```
public/index.html        דף ה-HTML (HUD, מסך פתיחה)
src/main.js              מצלמה, מעברים, אינטראקציה, לולאת רינדור
src/content.js           ← התוכן של האתר
src/audio.js             צלילים (WebAudio, בלי קבצי אודיו)
src/scene/index.js       החדר: קירות, חלון, אורות, סידור הרהיטים
src/scene/props.js       שולחן, כיסא, צמחים, מנורות, ספרים…
src/scene/macbook.js     ה-MacBook Air (מודל פרוצדורלי + המסך החי)
src/screen-size.js       גודל המסך הלוגי — מספר קטן יותר = כפתורים וטקסט גדולים יותר
src/scene/textures.js    טקסטורות שנוצרות בקוד (עץ, פוסטרים, מקלדת…)
src/ui/desktop.js        ה-macOS שרץ על המסך (חלונות, Dock, תפריטים, Spotlight…)
src/ui/desktop.css       העיצוב של macOS
src/styles.css           HUD, מסך פתיחה, מצב מובייל
```

## התאמות נפוצות

- **צבעי החדר** — `src/scene/props.js` (`createMaterials`) ו־`src/scene/index.js` (צבע הקירות/רצפה).
- **מיקום הרהיטים** — `src/scene/index.js`, כל פריט ממוקם בשורה אחת (ס"מ).
- **טפט המסך** — ה־SVG בתוך `createDesktop()` ב־`src/ui/desktop.js`.
- **גודל כפתורים וטקסט במסך** — `SCREEN_PX` ב־`src/screen-size.js` (ואותו מספר ב־`.mac` בקובץ ה־CSS).
- **אפליקציות והחלונות** — `APPS` ו־`TPL` ב־`src/ui/desktop.js`.
- **זווית מצלמה** — `OVERVIEW_BASE` ו־`FAR_BASE` בראש `src/main.js`.

## איך זה עובד (בקצרה)

המסך של ה־MacBook הוא אלמנט HTML רגיל שמוצג בתוך הסצנה בעזרת `CSS3DRenderer` של Three.js,
כך שאפשר ללחוץ, לגלול ולכתוב בתוכו כמו באתר רגיל — גם כשהמצלמה בתנועה.
במסכים צרים (פחות מ־860px) המצלמה נכנסת למסך ואז הממשק עובר לתצוגה מלאה כדי שיהיה קריא.

מקשים: `Esc` או כפתור המצלמה — להתרחק מהמסך. בתוך המסך: `Ctrl/⌘ + Space` פותח Spotlight.
