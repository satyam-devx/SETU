#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// patch-android-native.mjs
//
// android/ is gitignored and regenerated fresh every CI run
// (`npx cap add android`), so any native tweak has to be re-applied
// as a build step rather than committed once. This script runs right
// after `cap add android` (and after @capacitor/assets has generated
// icons/splash resources) and fixes the "OS splash -> blank white
// frame -> app splash" flash.
//
// Root cause: Android's system splash (drawn from styles.xml, before
// the Activity's WebView exists) hands off to a WebView whose default
// document background is white, per the CSS spec, regardless of the
// window's theme background. That white default paints for a frame
// or two before our own React SplashScreen (SplashScreen.jsx) has
// painted anything -- that's the flash. Fixing it needs two things,
// both native, both re-applied here every build:
//   1. MainActivity sets the WebView's background color to the same
//      cream (or dark) used everywhere else, so there is no "blank"
//      state to see -- it's the splash color the whole time.
//   2. The launch theme AND the running app theme's windowBackground
//      both match that same color, so the system splash frame and
//      the WebView frame are visually seamless even before/after the
//      WebView draws anything.
// ═══════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const LIGHT_BG = '#FDF8F0';
const DARK_BG = '#1A1512';

function findFile(startDir, filename) {
  const stack = [startDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === filename) return full;
    }
  }
  return null;
}

// ── 1. MainActivity: force the WebView background the instant it exists ──
const mainActivityPath = findFile('android/app/src/main/java', 'MainActivity.java');
if (!mainActivityPath) {
  console.error('[patch-android-native] Could not find MainActivity.java -- skipping WebView background patch.');
} else {
  let src = readFileSync(mainActivityPath, 'utf8');
  if (src.includes('setBackgroundColor')) {
    console.log('[patch-android-native] MainActivity already patched, skipping.');
  } else {
    src = src
      .replace(
        /import com\.getcapacitor\.BridgeActivity;/,
        `import com.getcapacitor.BridgeActivity;\nimport android.graphics.Color;\nimport android.os.Bundle;\nimport android.content.res.Configuration;`
      )
      .replace(
        /public class MainActivity extends BridgeActivity \{/,
        `public class MainActivity extends BridgeActivity {\n  @Override\n  public void onCreate(Bundle savedInstanceState) {\n    super.onCreate(savedInstanceState);\n    boolean isNight = (getResources().getConfiguration().uiMode\n        & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;\n    int bg = Color.parseColor(isNight ? "${DARK_BG}" : "${LIGHT_BG}");\n    getWindow().getDecorView().setBackgroundColor(bg);\n    if (getBridge() != null && getBridge().getWebView() != null) {\n      getBridge().getWebView().setBackgroundColor(bg);\n    }\n  }`
      );
    writeFileSync(mainActivityPath, src, 'utf8');
    console.log(`[patch-android-native] Patched ${mainActivityPath} -- WebView background fixed.`);
  }
}

// ── 2. styles.xml: give the running AppTheme the same windowBackground
//      that @capacitor/assets already set on the launch theme, so there's
//      no color seam between the two ──
const stylesPath = 'android/app/src/main/res/values/styles.xml';
if (existsSync(stylesPath)) {
  let xml = readFileSync(stylesPath, 'utf8');
  const before = xml;
  xml = xml.replace(
    /(<style name="AppTheme" parent="[^"]*">)/,
    `$1\n        <item name="android:windowBackground">@color/splashSeamBackground</item>`
  );
  if (xml !== before) {
    writeFileSync(stylesPath, xml, 'utf8');
    console.log(`[patch-android-native] Patched ${stylesPath} -- matching windowBackground added to AppTheme.`);
  }
}

// colors.xml: define the color referenced above (light + night variant)
const colorsPath = 'android/app/src/main/res/values/colors.xml';
if (existsSync(colorsPath)) {
  let xml = readFileSync(colorsPath, 'utf8');
  if (!xml.includes('splashSeamBackground')) {
    xml = xml.replace('</resources>', `    <color name="splashSeamBackground">${LIGHT_BG}</color>\n</resources>`);
    writeFileSync(colorsPath, xml, 'utf8');
    console.log(`[patch-android-native] Added splashSeamBackground to ${colorsPath}.`);
  }
}

const nightDir = 'android/app/src/main/res/values-night';
mkdirSync(nightDir, { recursive: true });
const nightColorsPath = path.join(nightDir, 'colors.xml');
if (!existsSync(nightColorsPath)) {
  writeFileSync(
    nightColorsPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="splashSeamBackground">${DARK_BG}</color>\n</resources>\n`,
    'utf8'
  );
  console.log(`[patch-android-native] Created ${nightColorsPath} for dark mode.`);
}

console.log('[patch-android-native] Done.');
