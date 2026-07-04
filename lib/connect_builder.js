'use strict';

const connect = require('connect');
const crypto = require('crypto');
const fs = require('fs');
const serveStatic = require('serve-static');
const expressSession = require('express-session');
const basicAuth = require('basic-auth-connect');

// constant-time string comparison so credential checks don't leak
// how many leading characters matched (timing attack)
const safeCompare = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

function ConnectBuilder(urlPath) {
  this.app = connect();
  this.urlPath = urlPath;
  this.app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
}

ConnectBuilder.prototype.authorize = function authorize(user, pass) {
  this.app.use(
    this.urlPath,
    basicAuth(
      (incomingUser, incomingPass) =>
        safeCompare(incomingUser, user) && safeCompare(incomingPass, pass)
    )
  );

  return this;
};

ConnectBuilder.prototype.build = function build() {
  return this.app;
};

ConnectBuilder.prototype.index = function index(
  path,
  files,
  filesNamespace,
  themeOpt,
  version
) {
  const theme = themeOpt || 'default';

  this.app.use(this.urlPath, (req, res) => {
    fs.readFile(path, (err, data) => {
      res.writeHead(200, {
        'Content-Type': 'text/html',
      });
      res.end(
        data
          .toString('utf-8')
          .replace(/__TITLE__/g, files)
          .replace(/__THEME__/g, theme)
          .replace(/__NAMESPACE__/g, filesNamespace)
          .replace(/__VERSION__/g, version || '')
          .replace(/__PATH__/g, this.urlPath),
        'utf-8'
      );
    });
  });

  return this;
};

ConnectBuilder.prototype.session = function sessionf(secret) {
  this.app.use(
    this.urlPath,
    expressSession({
      secret,
      resave: false,
      saveUninitialized: true,
    })
  );
  return this;
};

ConnectBuilder.prototype.static = function staticf(path) {
  this.app.use(this.urlPath, serveStatic(path));
  return this;
};

module.exports = (urlPath) => new ConnectBuilder(urlPath);
