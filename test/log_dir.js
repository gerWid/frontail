'use strict';

const fs = require('fs');
const path = require('path');
const temp = require('temp');
const logDir = require('../lib/log_dir');

describe('logDir', () => {
  temp.track();

  describe('discover', () => {
    it('finds regular files and skips rotated, compressed and binary logs', () => {
      const dir = temp.mkdirSync('frontail-logdir');
      [
        'foo.log',
        'messages',
        'bar.log.1',
        'baz.gz',
        'wtmp',
        'wtmp.db',
        'old.log.old',
      ].forEach((name) => fs.writeFileSync(path.join(dir, name), ''));
      fs.mkdirSync(path.join(dir, 'subdir'));

      const result = logDir.discover(dir);

      (result.error === null).should.be.true;
      result.files.should.be.eql([
        path.join(dir, 'foo.log'),
        path.join(dir, 'messages'),
      ]);
    });

    it('reports an error for a missing directory', () => {
      const result = logDir.discover('/does/not/exist');

      result.files.should.be.eql([]);
      result.error.should.be.ok;
    });
  });

  describe('pickDefault', () => {
    it('prefers the first explicitly passed file', () => {
      logDir
        .pickDefault(['/log/dpkg.log'], ['/log/a.log', '/log/dpkg.log'])
        .should.be.equal('/log/dpkg.log');
    });

    it('falls back to a file named messages', () => {
      logDir
        .pickDefault([], ['/log/a.log', '/log/messages'])
        .should.be.equal('/log/messages');
    });

    it('falls back to the first file found', () => {
      logDir
        .pickDefault([], ['/log/a.log', '/log/b.log'])
        .should.be.equal('/log/a.log');
    });

    it('returns null when there are no files', () => {
      (logDir.pickDefault([], []) === null).should.be.true;
    });
  });
});
