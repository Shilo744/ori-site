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

## בדיקות וצילומי מסך (smoke / shot)

הכלים משתמשים ב-Chrome (או Edge) שכבר מותקן במחשב דרך `playwright-core` — בלי הורדת דפדפן. הם בונים את האתר, מגישים את `dist/` על פורט אקראי ומריצים את הדפדפן (WebGL תוכנתי, בלי GPU).

```bash
npm run smoke                      # זרימה מלאה + פתיחת כל אפליקציה/משחק; נכשל על כל שגיאת קונסול/רשת
npm run smoke -- --sizes=1366x768  # גדלי מסך אחרים (ברירת מחדל: 1280x800 ו-390x844 = מצב flat)
npm run shot -- desk               # צילום אחד של זווית מצלמה: overview | desk | window | shelf | bench | plant | mac-close | iphone | ipad
npm run shot -- app:terminal T17-terminal   # חלון של אפליקציה (או game:<id>), הארגומנט השני הוא שם הקובץ
```

`npm run test:games` מריץ את בדיקות ה-logic הטהורות של המשחקים ב-node (`scripts/test-<game>.mjs`, כרגע 2048: 16 בדיקות על כללי החיבור/ניקוד/סוף משחק).

`npm run smoke -- --games` מוסיף בדיקות משחק מלאות (קלט אמיתי במקלדת, פאוזה, שמירת שיא, צילומי משחק) לכל משחק שיש לו בדיקה ב-`scripts/lib/games.mjs`; `npm run test:game -- snake` מריץ משחק אחד.

**חומרה:** ההרנס מעלה את Chrome על כרטיס המסך האמיתי (ANGLE/D3D11, headless; ב-RTX 3060: ~120fps, smoke מלא ב-~3 דקות) ושומר על SwiftShader כגיבוי אוטומטי. בכל הרצה מודפסת שורת `GL: <renderer>`. `ORI_SOFTWARE_GL=1` כופה רינדור תוכנה (דטרמיניסטי / CI; ~10x איטי יותר).

הצילומים נשמרים ב-`shots/` (מחוץ ל-git; ה-smoke שומר ב-`shots/smoke/`). דגלים שימושיים: `--size=WxH`, `--time=18.5`, `--wait=ms`, `--keys=ArrowUp,Space`, `--no-build`, `--headed`.

`npm run dom-snap -- before` / `-- after` שומר את ה-DOM המנורמל של כל האפליקציות/תפריטים/טרמינל ב-`shots/dom/<label>/` — להשוואה לפני/אחרי ריפקטור (`git diff --no-index --stat shots/dom/before shots/dom/after`).

הכתובת `?fast=1` מדלגת על ההקלדה באינטרו, על אנימציית האתחול ומקצרת את טיסות המצלמה (לבדיקות בלבד). ב-Console זמין `window.__ori`: `ready`, `openApp(id)`, `listApps()`, `setView(name)`, `setTime(hours)`, `stats()`.

## מבנה הפרויקט

```
public/index.html        דף ה-HTML (HUD, מסך פתיחה)
src/main.js              מצלמה, מעברים, אינטראקציה, לולאת רינדור
src/content.js           ← התוכן של האתר
src/audio.js             צלילים (WebAudio, בלי קבצי אודיו)
src/scene/index.js       החדר: קירות, חלון, אורות, סידור הרהיטים
src/scene/props.js       שולחן, כיסא, צמח, מנורה, ספה/ספסל, מדף… + החומרים (שמן/שיער לבד/קרמיקה ב-Physical)
src/scene/props-devices.js   מכשירים ואביזרי שולחן: iPhone/iPad/AirPods/HomePod/עכבר, מחברת, אוזניות, סוקולנט, מסגרת, כבל
src/scene/merge.js       איחוד meshes סטטיים לפי חומר (פחות draw calls)   ·   src/scene/textures2.js  טקסטורות פרוצדורליות נוספות
src/scene/macbook.js     ה-MacBook Air (מודל פרוצדורלי + המסך החי)
src/screen-size.js       גודל המסך הלוגי — מספר קטן יותר = כפתורים וטקסט גדולים יותר
src/scene/textures.js    טקסטורות שנוצרות בקוד (עץ, פוסטרים, מקלדת…)
src/scene/views.js       זוויות מצלמה בשם (desk, window, shelf… — לבדיקות ולסיור)
src/core/                שירותים: storage (ori2:), bus (אירועים), achievements, notify
src/ui/desktop.js        ה-macOS שרץ על המסך — מחבר את החלקים הבאים
src/ui/shell.js          ה-HTML של שולחן העבודה (טפט, תפריט, Dock, Control Center…)
src/ui/wm.js             מנהל החלונות: פתיחה, פוקוס, מזעור, גרירה, מקשים ו-pause/resume לאפליקציות
src/ui/menubar.js        תפריטי העליון   ·   src/ui/overlays.js  Spotlight + Control Center
src/ui/apps/             כל אפליקציה בקובץ משלה + registry.js (Dock, Spotlight והתפריטים קוראים ממנו)
src/ui/desktop.css       העיצוב של macOS
src/styles.css           HUD, מסך פתיחה, מצב מובייל
scripts/                 smoke / shot / dom-snap (בדיקות וצילומי מסך)
```

## זמן ביום (`src/scene/daylight.js`)

כפתור שמש/ירח ב-HUD (או המקש `T` כשמסתכלים על החדר) מחליף מצב: **Auto** (שעון מקומי אמיתי) → **Day** → **Golden hour** → **Night**, עם מעבר חלק של 1.5 שניות; המצב נשמר. הכול מונע ממצב אחד (`evalState(hours)` — טבלת key-frames בין 00:00 ל-24:00): כיוון/צבע/עוצמת השמש (בלילה: הירח) והצללים שזזים איתה, תאורת Hemisphere/Fill/Environment, חשיפה, צבע קירות ורצפה, פס ה-LED, זוהר מסך ה-MacBook, רקע הדף (`--bg1..3`, `--vig`) ומנורת הרצפה (PointLight אמיתי שנדלק בשקיעה; `daylight.lamp.setOn()` לעקיפה ידנית). השמיים בחלון הם ShaderMaterial אחד (גרדיאנט, שמש/ירח/כוכבים/עננים נעים/קו רקיע עם חלונות מוארים) — הכול דרך uniforms, בלי ליצור טקסטורות מחדש. בקונסול: `__ori.setTime(18.5)`.

## הסמן (בכל הדף)

סמן אחד לכל האתר — **סמני CSS אמיתיים** (חומרה, אפס השהיה, בדיוק איפה שה-hit-testing קורה) ולא חץ מצויר. `src/ui/cursors.js` הוא מקור האמת: תשע צורות SVG (`image-set` 1x+2x) — חץ, יד מצביעה, I-beam, יד פתוחה/סגורה וארבעת סמני שינוי הגודל בסגנון macOS (↔ ו-↕ עם פס אמצע דק, ושני אלכסונים; נקודת הקליק במרכז) — כמשתני `--cur-*` על `:root`. `src/ui/cursors.css` הוא הקובץ היחיד שמחליט איזו צורה איפה, ואף קובץ CSS/JS אחר לא כותב `cursor: pointer` וכו' (`node scripts/test-cursors.mjs` נכשל אם כן): חץ בכל מקום, יד על כל דבר לחיץ (HUD, חיצים, מסך הפתיחה, תפריטי המשחקים, וה-hover התלת-ממדי על חפצי החדר — `interactions.js` קובע `var(--cur-hand)`), I-beam בשדות טקסט. בתוך מסך ה-MacBook כמו ב-macOS: כפתורים ו-Dock = חץ, קישורים = יד, ידיות שינוי גודל = ↔ ↕ ⤡ ⤢. בזמן גרירה/שינוי גודל של חלון הצורה ננעלת על `<html>` (`dataset.cl`), גם אם המצביע יוצא מהמסך. `npm run test:cursors` עובר על כל אלמנט בדף ובודק שאין סמן מערכת. כשהמצלמה נעולה על המסך (`state === 'screen'`) החדר מצויר ב-~30fps וה-CSS3D נכתב מחדש רק כשהמטריצה משתנה, כדי שה-DOM (hover, גרירה, הקלדה) ירוץ במלוא המהירות. `node scripts/perf-screen.mjs` מודד את העלות לפריים.

## מסך הפתיחה וה-HUD (זכוכית)

**מסך הפתיחה** (`src/ui/intro.js` + `intro.css`) הוא דיאלוג (`role="dialog"`) מעל החדר החי: מסך זכוכית מטושטש (`backdrop-filter`) שגוון שלו עוקב אחרי שעת היום, מחזור ברכות Hello / שלום / Hola / こんにちは / Bonjour / مرحبا / Ciao (עם `lang`/`dir` נכונים) שנרגע על השם, וכפתור **Enter** שמופיע רק כשהחדר באמת מוכן (פונטים + פריים ראשון); Return/Space מתחילים, ו-pill של Sound משקף את הרמקול. ביציאה הטשטוש נמס והאלמנט כולו (כולל ה-`backdrop-filter`) מוסר מהדף. `?fast=1` מדלג על המחזור. `npm run test:intro`.

**ה-HUD** (`src/ui/hud.css`, אייקונים ב-`src/ui/hud-icons.js`) הוא מערכת זכוכית אחת: תוויות, כפתורי הצליל/שעה/מצלמה, חיצי "להסתכל מסביב", נקודות התחנות, ה-prompt וההתראות בחדר. הצבעים הם משתני `--g-*` ש-`scene/daylight.js` כותב לפי שעת היום (זכוכית לבנה ביום, כחול-גרפיט בלילה). פריסה ושכבות נשארו ב-`styles.css`; מטרות מגע 44px במכשירי מגע. `node scripts/hud-shots.mjs before|after` מצלם את ה-HUD במצבים העיקריים.

## "Ori, Can You...?" (src/game3d/favors) — השכונה

משחק התלת-ממד האישי: אורי, האיש שעושה הכול, בשכונה תל-אביבית (~290 × 296 מ׳, 109 בניינים, 14 מקומות עם שם: הבית, אמא, דודה, העירייה, בית פרח, שלוש עבודות, בית קפה, קיוסק, תחנה, פארק + חוף, מגרש, סדנה). הדף הזה מתאר את **הבמה** (T51): הליכה, ריצה, מצלמה, יום שעובר. המשימות והטלפון מגיעים ב-T52+.

- **כל המידע האישי והטקסטים בקובץ אחד**: `favors/content.js` — נתונים בלבד, וכל עובדה שעוד צריכה לבוא מאורי מסומנת `// TODO(real fact)`.
- `map.js` (טהור, דטרמיניסטי): רחובות, בלוקים, מקומות, דלתות, אביזרי רחוב, גרף רחובות ומרחקי הליכה בין כל שני מקומות; `validateMap` בודק שאין בניינים חופפים ושכל דלת ניתנת להגעה ברגל.
- `controller.js` (טהור, צעד קבוע): הליכה/ספרינט עם סטמינה (קפה ממלא), התנגשות בגלישה על קירות (`collide.js` — גיבוב מרחבי), מצלמה עוקבת שנמשכת פנימה לפני קיר (`camera-rig.js`). `daycycle.js`: שעון המשחק 06:00 → חצות (~14 דקות אמיתיות) והאור של היום.
- ציור: `buildings3d.js` (בנייני באוהאוס עם חלונות מוארים, גזוזטראות ושלטים), `ground3d.js` (מדרכות מוגבהות, כבישים, פארק, ים), `props3d.js` (מופעים — instancing), `crowd3d.js` (40 הולכי רגל ב-draw call אחד), `ori3d.js` (אורי: חיתוך הפנים מהתמונה `assets/ori-face.jpg` על ראש 1.3x, תלתלים, משקפיים, עגיל, שרשרת). התמונה הגדולה לא נשלחת לאתר — רק חיתוך קטן בלי EXIF (`node scripts/make-ori-face.mjs`).
- **המשימות והטלפון (T52):** `quests.js` (טהור, עם seed) הוא מנוע המשימות: ה"במאי" מתכנן את כל היום מראש (טוטוריאל של שלוש משימות, טפטוף שעולה לאורך היום, התפרצויות של 2–3 משימות, כפל-הזמנות במקומות רחוקים, שיחות "דחוף!!!" מאמא שהן טריוויאליות), כל משימה חיה במחזור new → accepted → done / failed / declined / delegated, ויש מד כאוס, שבעה מדי יחסים, ניקוד עם בונוס מוקדם ורצף, "נא לא להפריע" (עד שעה, ואז המתנה), מנטורים שלוקחים משימות פשוטות (3 אסימונים), והדוח של חצות. **שמירת היתכנות:** לכל משימה ניתן זמן שמספיק לבצע אותה *לבד* מכל נקודה בעיר (מרחקי הליכה מ-`map.dist`). 66 תבניות ב-6 משפחות ב-`content.js` (כולן עם `doText`), `scripts/test-favors-quests.mjs` (37 בדיקות, כולל 200 ימי בוט לכל רמת קושי). `phone.js`: בועות התראה שמחליקות פנימה עם זמזום (ורעידת מסך קלה ב"דחוף"), `Tab` מחליף את הטלפון — **לא-מודלי**: פאנל קומפקטי בקצה הימני (~רבע מהרוחב), היום רץ במהירות רגילה ו-WASD ממשיך ללכת; בזמן הליכה הוא מצטמצם ל-peek ונפתח שוב כשאורי עומד; מקשים: `1-9` לבחור משימה, `F` לעקוב, `Y/L/N` לענות, `[ ]` להחליף לשונית. משימות לפי דד-ליין, מפה עם סיכות, הודעות עם תשובות מהירות, Focus + מנטורים. קרן אור וחץ בקצה המסך מובילים למשימה שעוקבים אחריה. עד שהמשימות יקבלו שיחות ופנים (T61-T63) הקשת `רווח` ליד הדלת פשוט עושה את הטובה. **פרסונה:** אורי תמיד חיובי — כל מחרוזת בקולו ב-`texts.js` נבדקת ב-`scripts/test-favors-persona.mjs` (אין "missed", "failed", "sorry"; פספוס זמן = "rain check").
- ההרצה: `__ori.game3d.launch('favors', { quick: true })`. בדיקות: `npm run test:favors` (24 בדיקות טהורות + בלוק דפדפן `favors3d`); `node scripts/favors-shot.mjs` לצילומים, `node scripts/favors-perf.mjs` לזמני פריים.

## חלונות (window manager)

גרירה מסרגל הכותרת (נעצר מתחת לתפריט העליון), שינוי גודל מכל קצה/פינה (עם הגבלת `minW/minH` של האפליקציה וסמן מתאים: ↔ ↕ ⤡ ⤢), כפתור ירוק / לחיצה כפולה על הכותרת = zoom (ממלא את המסך בין התפריט ל-Dock, מונפש), גרירה לקצה שמאל/ימין = חצי מסך ולקצה העליון = zoom (עם תצוגה מקדימה שקופה), מזעור עם אנימציה אל ה-Dock — החלון מקבל תמונה ממוזערת ב-Dock (גם משחקים שאין להם אייקון), לחיצה עליה מחזירה אותו. הגודל והמיקום האחרון נשמרים לכל אפליקציה; חלונות חדשים נפתחים בסידור מדורג. מקשים: ⌘W / ⌘M / ⌃⌘F כש-metaKey זמין (דפדפנים שומרים ל-Ctrl+W/T/N וכד' ולכן אין בהם שימוש) — תפריט Window (Minimize, Zoom, Tile Left/Right) תמיד עובד. במצב flat (מובייל) אין גרירה/שינוי גודל/snap.

## להוסיף אפליקציה (או משחק)

1. קובץ חדש `src/ui/apps/<id>.js` שקורא ל-`registerApp({ id, name, icon, size, category, dock, titlebar, mount(el, ctx) })` — ראו את ההערה בראש `src/ui/apps/registry.js` לכל השדות.
2. שורת import אחת ב-`src/ui/apps/index.js` (הסדר שם = הסדר ב-Dock).
3. זה הכול: ה-Dock (`dock: true`), Spotlight, תפריט Window, ופקודת `open` בטרמינל מתעדכנים לבד.

**משחק חדש:** קובץ ב-`src/ui/games/<id>.js` שקורא ל-`registerApp({ category: 'game', titlebar: 'dark', … })` ונבנה מ-`kit.js` (לולאה קבועה `createRuntime`, `fitCanvas`, `createInput`+`createPad` למקלדת/swipe/כפתורים, `createHud`, `createOverlay`, `createParticles`), `scores.js` (שיא + 10 ריצות אחרונות) וצלילי `blip/sweep/noiseHit/arp` מ-`audio.js`; שורת import אחת ב-`src/ui/games/index.js`. הדוגמה: `snake.js`. מראה משותף ב-`games.css`.

`mount` מקבל את אלמנט התוכן ו-`ctx` (`sound`, `storage`, `bus`, `achievements`, `notify`, `content`, `open(id, args)`, `win.setTitle/close/size`, `onKey(handler)`, `isInteractive()`) ומחזיר `{ destroy, onFocus, onBlur, onResize, onOpen, pause, resume }` (הכול אופציונלי). `onKey` מקבל keydown+keyup רק כשהחלון פעיל והמסך חי; החזרת `true` עושה `preventDefault`.

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
