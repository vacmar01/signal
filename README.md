# Signal

A minimal web radio PWA for iPhone. Tune into saved stations, search the
[Radio Browser](https://www.radio-browser.info/) directory, and control playback
from the lock screen.

Built with plain HTML, CSS, and JavaScript—no framework, build step, or backend.

## Run locally

```sh
python3 -m http.server 8080
```

Open <http://localhost:8080>. For the app-like iPhone experience, serve it over
HTTPS, open it in Safari, and choose **Share → Add to Home Screen**.

Stations are stored locally in the browser. Stream URLs must support HTTPS when
the app is hosted over HTTPS.
