# Mahamaya EMR — PWA Add-on

इन files को GitHub repository की root directory में upload करें:

- `manifest.webmanifest`
- `service-worker.js`
- `install-pwa.js`
- पूरा `icons` folder

फिर मौजूदा `index.html` के `<head>` में यह जोड़ें:

```html
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#1c8ba3">
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

और `</body>` से ठीक पहले यह जोड़ें:

```html
<script src="install-pwa.js"></script>
```

Commit के बाद GitHub Pages को 2–5 मिनट दें। Chrome में website खोलें → menu → **Add to Home screen / Install app**.

महत्वपूर्ण:
- Service worker पहली सफल online visit के बाद offline cache बनाता है।
- Patient data यदि localStorage में है, तो वह उसी browser/app storage में रहेगा।
- Browser data clear या app uninstall करने से local records मिट सकते हैं; नियमित backup रखें।
