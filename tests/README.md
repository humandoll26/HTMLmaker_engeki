# ローカル回帰検証

Node.js、PlaywrightとGoogle Chromeを用意し、リポジトリを
`python -m http.server 8765 --bind 127.0.0.1`等でローカル配信します。

```powershell
$env:BASE_URL = 'http://127.0.0.1:8765/'
$env:TEST_OUTPUT = Join-Path $env:TEMP ('theater-lp-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Force $env:TEST_OUTPUT | Out-Null
node tests/security-regression.cjs
```

別の場所のPlaywrightは`PLAYWRIGHT_MODULE`に絶対パスを指定します。
新しいブラウザコンテキストと合成JSON・PNGだけを使用し、外部HTTPアクセスは遮断します。
起動時の下書き復元、JSONインポート、手入力、明示的な保存・復元、属性・URL・CSS注入、
スクリプトを許可しないsandbox、画像選択、セクション編集、モバイル・PC、
HTML/CSS/JSONダウンロード、完成HTMLのfile://表示を検証します。
メール・電話の予約CTAと相対URLも維持します。
ローカル画像埋め込みはPNG/JPEG/GIF/WebP/AVIF/BMP/ICOのみを許可し、SVG data URLは拒否します。
危険な値は保存データから消さず、プレビューから除外し、書き出し時にエラー表示します。
