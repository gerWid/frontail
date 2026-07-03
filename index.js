'use strict';

const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { Server } = require('socket.io');
const fs = require('fs');
const untildify = require('untildify');
const pkg = require('./package.json');
const tail = require('./lib/tail');
const connectBuilder = require('./lib/connect_builder');
const program = require('./lib/options_parser');
const serverBuilder = require('./lib/server_builder');
const daemonize = require('./lib/daemonize');

/**
 * Parse args
 */
program.parse(process.argv);
if (program.args.length === 0) {
  console.error('Arguments needed, use --help');
  process.exit();
}

/**
 * Validate params
 */
const doAuthorization = !!(program.user && program.password);
const doSecure = !!(program.key && program.certificate);
const sessionSecret = String(+new Date()) + Math.random();
const files = program.args.join(' ');
const filesNamespace = crypto.createHash('md5').update(files).digest('hex');
const urlPath = program.urlPath.replace(/\/$/, ''); // remove trailing slash

if (program.daemonize) {
  daemonize(__filename, program, {
    doAuthorization,
    doSecure,
  });
} else {
  /**
   * HTTP(s) server setup
   */
  const appBuilder = connectBuilder(urlPath);
  if (doAuthorization) {
    appBuilder.session(sessionSecret);
    appBuilder.authorize(program.user, program.password);
  }
  appBuilder
    .static(path.join(__dirname, 'web', 'assets'))
    .index(
      path.join(__dirname, 'web', 'index.html'),
      files,
      filesNamespace,
      program.theme
    );

  const builder = serverBuilder();
  if (doSecure) {
    builder.secure(program.key, program.certificate);
  }
  const server = builder
    .use(appBuilder.build())
    .port(program.port)
    .host(program.host)
    .build();

  /**
   * socket.io setup
   */
  const io = new Server({ path: `${urlPath}/socket.io` });
  io.attach(server);

  if (doAuthorization) {
    io.use((socket, next) => {
      const handshakeData = socket.request;
      if (handshakeData.headers.cookie) {
        const cookies = cookie.parse(handshakeData.headers.cookie);
        const sessionIdEncoded = cookies['connect.sid'];
        if (!sessionIdEncoded) {
          return next(new Error('Session cookie not provided'), false);
        }
        const sessionId = cookieParser.signedCookie(
          sessionIdEncoded,
          sessionSecret
        );
        if (sessionId) {
          return next(null);
        }
        return next(new Error('Invalid cookie'), false);
      }

      return next(new Error('No cookie in header'), false);
    });
  }

  /**
   * Setup UI highlights
   */
  let highlightConfig;
  if (program.uiHighlight) {
    let presetPath;

    if (!program.uiHighlightPreset) {
      presetPath = path.join(__dirname, 'preset', 'default.json');
    } else {
      presetPath = path.resolve(untildify(program.uiHighlightPreset));
    }

    if (fs.existsSync(presetPath)) {
      highlightConfig = JSON.parse(fs.readFileSync(presetPath));
    } else {
      throw new Error(`Preset file ${presetPath} doesn't exists`);
    }
  }

  /**
   * Tail each file with its own tailer so every emitted line can be tagged
   * with its source. This lets the UI offer a dropdown to switch between logs
   * when more than one file is tailed. stdin is a single source named 'stdin'.
   */
  const isStdin = program.args[0] === '-';
  const sources = isStdin ? ['stdin'] : program.args;

  const filesSocket = io.of(`/${filesNamespace}`);

  const tailers = sources.map((source, index) => {
    const target = isStdin ? ['-'] : [program.args[index]];
    const tailer = tail(target, {
      buffer: program.number,
    });
    tailer.on('line', (line) => {
      filesSocket.emit('line', { line, source });
      if (program.stdout) {
        // echo to stdout (e.g. for docker logs); prefix with the source
        // when tailing multiple files
        console.log(sources.length > 1 ? `${source}: ${line}` : line);
      }
    });
    return { source, tailer };
  });

  /**
   * When connected send starting data
   */
  filesSocket.on('connection', (socket) => {
    socket.emit('options:lines', program.lines);

    if (program.uiHideTopbar) {
      socket.emit('options:hide-topbar');
    }

    if (!program.uiIndent) {
      socket.emit('options:no-indent');
    }

    if (program.uiHighlight) {
      socket.emit('options:highlightConfig', highlightConfig);
    }

    socket.emit('options:files', sources);

    tailers.forEach(({ source, tailer }) => {
      tailer.getBuffer().forEach((line) => {
        socket.emit('line', { line, source });
      });
    });
  });

  /**
   * Startup diagnostics — status, addresses and a health check for every
   * source, prefixed so they are distinguishable from `--stdout` log lines.
   */
  const logStartup = (msg) => console.log(`[frontail] ${msg}`);

  const formatBytes = (size) => {
    const units = ['B', 'kB', 'MB', 'GB'];
    const i = Math.min(
      units.length - 1,
      Math.floor(Math.log(size) / Math.log(1024))
    );
    return `${(size / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const scheme = doSecure ? 'https' : 'http';

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logStartup(
        `ERROR: ${program.host}:${program.port} is already in use — ` +
          'choose another port (-p) or stop the other process'
      );
    } else if (err.code === 'EACCES') {
      logStartup(
        `ERROR: no permission to bind ${program.host}:${program.port} ` +
          '(ports below 1024 need elevated privileges)'
      );
    } else {
      logStartup(`ERROR: server failed to start: ${err.message}`);
    }
    process.exit(1);
  });

  server.on('listening', () => {
    const address = server.address();

    logStartup(`frontail v${pkg.version} started`);
    if (fs.existsSync('/.dockerenv')) {
      logStartup('environment: docker container');
    }
    logStartup(`listening on ${scheme}://${address.address}:${address.port}`);
    if (address.address === '0.0.0.0' || address.address === '::') {
      logStartup(`  local:   ${scheme}://127.0.0.1:${address.port}${urlPath}`);
      Object.entries(os.networkInterfaces()).forEach(([name, addrs]) => {
        (addrs || []).forEach((a) => {
          if (a.family === 'IPv4' && !a.internal) {
            logStartup(
              `  network: ${scheme}://${a.address}:${address.port}${urlPath} (${name})`
            );
          }
        });
      });
    }
    logStartup(
      `config: theme=${program.theme} | auth=${
        doAuthorization ? 'on' : 'off'
      } | https=${doSecure ? 'on' : 'off'} | stdout-echo=${
        program.stdout ? 'on' : 'off'
      } | buffer=${program.number} lines`
    );

    logStartup(`tailing ${sources.length} source(s):`);
    let warnings = 0;
    sources.forEach((source) => {
      if (source === 'stdin') {
        logStartup('  OK   stdin');
        return;
      }
      try {
        fs.accessSync(source, fs.constants.R_OK);
        const { size } = fs.statSync(source);
        logStartup(
          `  OK   ${source} (${size === 0 ? 'empty' : formatBytes(size)})`
        );
      } catch (e) {
        warnings += 1;
        logStartup(
          `  WARN ${source}: not readable or missing — ` +
            'lines will appear once the file exists'
        );
      }
    });

    if (warnings === 0) {
      logStartup('ready — all sources look good');
    } else {
      logStartup(`ready — with ${warnings} warning(s), see above`);
    }
  });

  /**
   * Handle signals
   */
  const cleanExit = () => {
    process.exit();
  };
  process.on('SIGINT', cleanExit);
  process.on('SIGTERM', cleanExit);
}
