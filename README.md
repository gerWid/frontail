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
- themes (default, dark)
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

- **Log file(s):** edit the `command:` list in `compose.yaml`. Paths are _inside_
  the container (the host log directory is mounted at `/log`). List several files
  to get the [log dropdown](#switching-between-multiple-logs) in the UI, e.g.

  ```yaml
      command:
        - "--ui-highlight"
        - "/log/syslog"
        - "/log/auth.log"
  ```

- `FRONTAIL_LOG_DIR` – host directory mounted read-only at `/log` (default `/var/log`)
- `FRONTAIL_PORT` – host port to expose (default `9001`)

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
      --path <path>                 prefix path for the running application, default /
      --help                        output usage information

Web interface runs on **http://[host]:[port]**.

### Tailing multiple files

`[file ...]` accepts multiple paths, `*`, `?` and other shell special characters([Wildcards, Quotes, Back Quotes and Apostrophes in shell commands](http://www.codecoffee.com/tipsforlinux/articles/26-1.html)).

#### Switching between multiple logs

When more than one file is tailed, a dropdown appears in the top bar. Pick a file
to show only its lines, or choose **All logs** to see every file merged together
(the default). The source filter combines with the search filter, so you can, for
example, search within a single log.

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
