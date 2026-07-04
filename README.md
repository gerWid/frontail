# frontail – streaming logs to the browser

`frontail` is a Node.js application for streaming logs to the browser. It's a `tail -F` with UI.

![frontial](https://user-images.githubusercontent.com/455261/29570317-660c8122-8756-11e7-9d2f-8fea19e05211.gif)

[![Docker Pulls](https://img.shields.io/docker/pulls/mthenw/frontail.svg)](https://hub.docker.com/r/mthenw/frontail/)

## Quick start

- `npm i frontail -g` or download a binary file from [Releases](https://github.com/mthenw/frontail/releases) page
- `frontail /var/log/syslog`
- visit [http://127.0.0.1:9001](http://127.0.0.1:9001)

## Features

- log rotation (not on Windows)
- auto-scrolling
- marking logs
- pausing logs
- number of unread logs in favicon
- themes (default, dark), switchable [directly in the UI](#ui-controls)
- adjustable log font size (A− / A+ [in the topbar](#ui-controls))
- optional [zebra-striped lines](#ui-controls)
- [highlighting](#highlighting)
- search (`Tab` to focus, `Esc` to clear) with [matches highlighted](#search) in the shown lines
- set filter from url parameter `filter`
- tailing [multiple files](#tailing-multiple-files) with a [dropdown to switch between logs](#switching-between-multiple-logs), and [stdin](#stdin)
- basic authentication

## Installation options

- download a binary file from [Releases](https://github.com/gerwid/frontail/releases) page
- using [npm package](https://www.npmjs.com/package/frontail): `npm i frontail -g`
- building the Docker image yourself: `docker build -t frontail . && docker run -d -P -v /var/log:/log frontail /log/syslog`
- using [Docker Compose](#docker-compose)

### Docker Compose

A ready-to-edit [`compose.yaml`](compose.yaml) is included. Build and start with:

    docker compose up -d --build

Then open [http://127.0.0.1:9001](http://127.0.0.1:9001).

Configure it either by editing `compose.yaml` directly or via environment variables:

- **Log files:** the bundled `command:` passes `--log-dir /log`, so **every** log
  file in the mounted folder shows up in the
  [UI dropdown](#switching-between-multiple-logs) automatically. Paths are
  _inside_ the container (the host log directory is mounted at `/log`). The file
  listed after `--log-dir` is preselected; remove it to preselect `/log/messages`
  (or the first file found), e.g.

  ```yaml
      command:
        - "--ui-highlight"
        - "--log-dir"
        - "/log"
        - "/log/syslog"
  ```

- `FRONTAIL_LOG_DIR` – host directory mounted read-only at `/log` (default `/var/log`)
- `FRONTAIL_PORT` – host port to expose (default `9001`)
- `FRONTAIL_BIND` – host interface the port is bound to (default `127.0.0.1`,
  the safe choice behind a reverse proxy; set `0.0.0.0` to expose frontail
  directly on the network)
- `FRONTAIL_THEME` – UI theme, `dark` (default) or `default` (light)

The bundled compose file is hardened: the container runs as an unprivileged
user (group `adm` so it can read the root-owned logs in `/var/log`), with a
read-only filesystem, all capabilities dropped and `no-new-privileges`. TLS is
best terminated at a reverse proxy in front of frontail (see
[Running behind nginx](#running-behind-nginx)); for end-to-end encryption
frontail also supports HTTPS directly via `-k`/`-c`.

The bundled `compose.yaml` passes `--stdout`, so the tailed lines also show up in
`docker compose logs -f frontail`. Remove that flag from the `command:` list if
you only want them in the browser.

On startup frontail prints `[frontail]`-prefixed diagnostics to stdout: version,
listen addresses (local and network), the effective configuration and an
`OK`/`WARN` health check for every tailed file — so `docker compose logs` tells
you at a glance whether everything is fine.

  ```sh
  FRONTAIL_LOG_DIR=/var/log FRONTAIL_PORT=9500 docker compose up -d --build
  ```

## Usage

    frontail [options] [file ...]

    Options:

      -V, --version                 output the version number
      -h, --host <host>             listening host, default 0.0.0.0
      -p, --port <port>             listening port, default 9001
      -n, --number <number>         starting lines number, default 10
      -l, --lines <lines>           number on lines stored in browser, default 2000
      -t, --theme <theme>           name of the theme (default, dark)
      -d, --daemonize               run as daemon
      -U, --user <username>         Basic Authentication username, option works only along with -P option
      -P, --password <password>     Basic Authentication password, option works only along with -U option
      -k, --key <key.pem>           Private Key for HTTPS, option works only along with -c option
      -c, --certificate <cert.pem>  Certificate for HTTPS, option works only along with -k option
      --pid-path <path>             if run as daemon file that will store the process id, default /var/run/frontail.pid
      --log-path <path>             if run as daemon file that will be used as a log, default /dev/null
      --url-path <path>             URL path for the browser application, default /
      --ui-hide-topbar              hide topbar (log file name and search box)
      --ui-no-indent                don't indent log lines
      --ui-highlight                highlight words or lines if defined string found in logs, default preset
      --ui-highlight-preset <path>  custom preset for highlighting (see ./preset/default.json)
      --stdout                      print tailed lines also to standard output (useful for docker logs)
      --log-dir <dir>               make every log file in <dir> selectable in the UI (in addition to [file ...])
      --path <path>                 prefix path for the running application, default /
      --help                        output usage information

Web interface runs on **http://[host]:[port]**.

### Tailing multiple files

`[file ...]` accepts multiple paths, `*`, `?` and other shell special characters([Wildcards, Quotes, Back Quotes and Apostrophes in shell commands](http://www.codecoffee.com/tipsforlinux/articles/26-1.html)).

#### Switching between multiple logs

A dropdown right after the `tail -f` label in the top bar lists every tailed
file with its absolute path — so the top bar reads like the actual command,
e.g. `tail -f /log/messages`. Pick a file to show only its lines; with more
than one file an **All logs** entry shows everything merged.
The source filter combines with the search filter, so you can, for example,
search within a single log.

With `--log-dir <dir>` every tailable log file found in `<dir>` is offered in the
dropdown as well (rotated/compressed/binary files like `*.1`, `*.gz` or `wtmp`
are skipped). The directory is rescanned on every page load, and the small
refresh button next to the dropdown rescans it on demand — log files created
in the meantime then show up in the dropdown without a reload. Which file is
preselected:

1. the first file passed as `[file ...]` argument,
2. otherwise `messages` in the log dir,
3. otherwise the first file found.

### UI controls

The topbar offers, next to the pause button:

- **A− / A+** – decrease/increase the log font size (50%–300%)
- **stripes icon** – toggle zebra striping: alternate visible lines get a tinted
  background (dark theme: `#121212`/`#2e2e2e`, light theme: white/`#e4e4e4`),
  which makes long lines much easier to follow
- **moon icon** – switch between the dark and light theme on the fly

All three choices are saved in the browser (localStorage) and restored on the
next visit. The `-t/--theme` server option only sets the initial default.

### Search

Type in the filter box (`Tab` to focus, `Esc` to clear) to show only lines that
match. The filter is treated as a case-insensitive regular expression, and every
match inside the visible lines is highlighted so it is easy to spot. The current
filter is also stored in the `filter` URL parameter, so a filtered view can be
bookmarked or shared.

### stdin

Use `-` for streaming stdin:

    ./server | frontail -

### Highlighting

`--ui-highlight` option turns on highlighting in UI. By default preset from `./preset/default.json` is used:

```
{
    "words": {
        "err": "color: red;"
    },
    "lines": {
        "err": "font-weight: bold;"
    }
}
```

which means that every "err" string will be in red and every line containing "err" will be bolded.

_New presets are very welcome. If you don't like default or you would like to share yours, please create PR with json file._

Available presets:

- default
- npmlog
- python

### Running behind nginx

Using the `--url-path` option `frontail` can run behind nginx with the example configuration

Using `frontail` with `--url-path /frontail`

```
events {
    worker_connections 1024;
}

http {
    server {
        listen      8080;
        server_name localhost;

        location /frontail {
            proxy_pass http://127.0.0.1:9001/frontail;

            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```
