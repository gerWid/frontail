'use strict';

const fs = require('fs');
const path = require('path');

// rotated/compressed/binary files that are not useful to tail as text
const EXCLUDED_PATTERNS = /(\.gz|\.xz|\.bz2|\.zst|\.zip|\.old|\.journal|\.db|\.sqlite3?|\.[0-9]+)$/i;
const EXCLUDED_NAMES = [
  'wtmp',
  'btmp',
  'utmp',
  'lastlog',
  'faillog',
  'tallylog',
];

/**
 * Discover tailable log files in a directory (non-recursive): regular,
 * readable files that are not rotated, compressed or known binary logs.
 *
 * @param {String} dir
 * @return {Object} { files: [String], error: String|null }
 */
const discover = (dir) => {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return { files: [], error: e.message };
  }

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (name) =>
        EXCLUDED_NAMES.indexOf(name) === -1 && !EXCLUDED_PATTERNS.test(name)
    )
    .map((name) => path.join(dir, name))
    .filter((file) => {
      try {
        fs.accessSync(file, fs.constants.R_OK);
        return true;
      } catch (e) {
        return false;
      }
    })
    .sort();

  return { files, error: null };
};

/**
 * Pick the source that should be preselected in the UI:
 * 1. the first explicitly passed file,
 * 2. otherwise a file named "messages",
 * 3. otherwise the first file found.
 *
 * @param {Array} explicitFiles files passed on the command line
 * @param {Array} allFiles all available files (explicit + discovered)
 * @return {String|null}
 */
const pickDefault = (explicitFiles, allFiles) => {
  if (explicitFiles.length > 0) {
    return explicitFiles[0];
  }
  if (allFiles.length === 0) {
    return null;
  }
  return (
    allFiles.find((file) => path.basename(file) === 'messages') || allFiles[0]
  );
};

module.exports = { discover, pickDefault };
