/* global Tinycon:false, ansi_up:false */

window.App = (function app(window, document) {
  'use strict';

  /**
   * @type {Object}
   * @private
   */
  var _socket;

  /**
   * @type {HTMLElement}
   * @private
   */
  var _logContainer;

  /**
   * @type {HTMLElement}
   * @private
   */
  var _filterInput;

  /**
   * @type {String}
   * @private
   */
  var _filterValue = '';

  /**
   * @type {HTMLElement}
   * @private
   */
  var _pauseBtn;

  /**
   * @type {boolean}
   * @private
   */
  var _isPaused = false;

  /**
   * @type {number}
   * @private
   */
  var _skipCounter = 0;

  /**
   * @type {HTMLElement}
   * @private
   */
  var _topbar;

  /**
   * @type {HTMLElement}
   * @private
   */
  var _body;

  /**
   * @type {number}
   * @private
   */
  var _linesLimit = Math.Infinity;

  /**
   * @type {number}
   * @private
   */
  var _newLinesCount = 0;

  /**
   * @type {boolean}
   * @private
   */
  var _isWindowFocused = true;

  /**
   * @type {object}
   * @private
   */
  var _highlightConfig;

  /**
   * @type {HTMLElement}
   * @private
   */
  var _logSelect;

  /**
   * Currently selected source file, or 'all' to show every log.
   *
   * @type {String}
   * @private
   */
  var _sourceFilter = 'all';

  /**
   * Test if a line matches the current text filter. Invalid regexes never hide
   * anything (treated as "matches").
   *
   * @param {String} text
   * @return {boolean}
   * @private
   */
  var _matchesFilter = function(text) {
    if (_filterValue === '') {
      return true;
    }
    try {
      return new RegExp(_filterValue, 'i').test(text);
    } catch (e) {
      return true;
    }
  };

  /**
   * Hide element if it doesn't match the text filter or the selected source
   *
   * @param {Object} element
   * @private
   */
  var _filterElement = function(elem) {
    var element = elem;
    var source = element.getAttribute('data-source');
    var matchesSource = _sourceFilter === 'all' || source === null || source === _sourceFilter;
    if (matchesSource && _matchesFilter(element.textContent)) {
      element.style.display = '';
    } else {
      element.style.display = 'none';
    }
  };

  /**
   * Remove previously inserted search-highlight wrappers from an element,
   * merging the freed text back into its surrounding text nodes.
   *
   * @param {HTMLElement} root
   * @private
   */
  var _clearSearchHighlight = function(root) {
    var marks = root.querySelectorAll('span.search-highlight');
    var i = marks.length;
    var mark;
    var parent;
    while (i) {
      mark = marks[i - 1];
      parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
      i -= 1;
    }
  };

  /**
   * Wrap every occurrence of the current filter value inside an element in
   * <span class="search-highlight"> so matches stand out in the shown lines.
   * Operates on text nodes only, so it never corrupts existing markup (ansi
   * colors, word highlights).
   *
   * @param {HTMLElement} root
   * @private
   */
  var _applySearchHighlight = function(root) {
    var regex;
    var walker;
    var textNodes = [];

    _clearSearchHighlight(root);

    if (_filterValue === '') {
      return;
    }

    try {
      regex = new RegExp('(' + _filterValue + ')', 'gi');
    } catch (e) {
      return;
    }

    walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach(function(node) {
      var text = node.nodeValue;
      var fragment = document.createDocumentFragment();
      var lastIndex = 0;
      var match;
      var matched;
      var span;

      regex.lastIndex = 0;
      if (!regex.test(text)) {
        return;
      }
      regex.lastIndex = 0;

      match = regex.exec(text);
      while (match !== null) {
        [matched] = match;
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        span = document.createElement('span');
        span.className = 'search-highlight';
        span.textContent = matched;
        fragment.appendChild(span);
        lastIndex = match.index + matched.length;
        if (matched.length === 0) {
          regex.lastIndex += 1;
        }
        match = regex.exec(text);
      }
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      node.parentNode.replaceChild(fragment, node);
    });
  };

  /**
   * Filter logs based on _filterValue
   *
   * @function
   * @private
   */
  var _filterLogs = function() {
    var collection = _logContainer.childNodes;
    var i = collection.length;
    var element;
    var inner;

    if (i === 0) {
      return;
    }

    while (i) {
      element = collection[i - 1];
      _filterElement(element);
      inner = element.querySelector('.inner-line');
      if (inner) {
        _applySearchHighlight(inner);
      }
      i -= 1;
    }
    window.scrollTo(0, document.body.scrollHeight);
  };

  /**
   * Build the log-selection dropdown from the list of tailed files. Hidden when
   * only a single source is tailed.
   *
   * @param {Array} files
   * @private
   */
  var _buildFileDropdown = function(files) {
    var allOption;

    if (!_logSelect || !files || files.length < 2) {
      return;
    }

    _logSelect.innerHTML = '';

    allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All logs';
    _logSelect.appendChild(allOption);

    files.forEach(function(file) {
      var option = document.createElement('option');
      option.value = file;
      // show just the file name, keep the full path in the tooltip
      option.textContent = file.replace(/^.*[\\/]/, '');
      option.title = file;
      _logSelect.appendChild(option);
    });

    _logSelect.style.display = '';
  };

  /**
   * Set _filterValue from URL parameter `filter`
   *
   * @function
   * @private
   */
  var _setFilterValueFromURL = function(filterInput, uri) {
    var _url = new URL(uri);
    var _filterValueFromURL = _url.searchParams.get('filter');
    if (typeof _filterValueFromURL !== 'undefined' && _filterValueFromURL !== null) {
      _filterValue = _filterValueFromURL;
      filterInput.value = _filterValue; // eslint-disable-line
    }
  };

  /**
   * Set parameter `filter` in URL
   *
   * @function
   * @private
   */
  var _setFilterParam = function(value, uri) {
    var _url = new URL(uri);
    var _params = new URLSearchParams(_url.search.slice(1));
    if (value === '') {
      _params.delete('filter');
    } else {
      _params.set('filter', value);
    }
    _url.search = _params.toString();
    window.history.replaceState(null, document.title, _url.toString());
  };

  /**
   * @return void
   * @private
   */
  var _faviconReset = function() {
    _newLinesCount = 0;
    Tinycon.setBubble(0);
  };

  /**
   * @return void
   * @private
   */
  var _updateFaviconCounter = function() {
    if (_isWindowFocused || _isPaused) {
      return;
    }

    if (_newLinesCount < 99) {
      _newLinesCount += 1;
      Tinycon.setBubble(_newLinesCount);
    }
  };

  /**
   * @return String
   * @private
   */
  var _highlightWord = function(line) {
    var output = line;

    if (_highlightConfig && _highlightConfig.words) {
      Object.keys(_highlightConfig.words).forEach((wordCheck) => {
        output = output.replace(
          wordCheck,
          '<span style="' + _highlightConfig.words[wordCheck] + '">' + wordCheck + '</span>',
        );
      });
    }

    return output;
  };

  /**
   * @return HTMLElement
   * @private
   */
  var _highlightLine = function(line, container) {
    if (_highlightConfig && _highlightConfig.lines) {
      Object.keys(_highlightConfig.lines).forEach((lineCheck) => {
        if (line.indexOf(lineCheck) !== -1) {
          container.setAttribute('style', _highlightConfig.lines[lineCheck]);
        }
      });
    }

    return container;
  };

  return {
    /**
     * Init socket.io communication and log container
     *
     * @param {Object} opts options
     */
    init: function init(opts) {
      var self = this;

      // Elements
      _logContainer = opts.container;
      _filterInput = opts.filterInput;
      _filterInput.focus();
      _logSelect = opts.logSelect;
      _pauseBtn = opts.pauseBtn;
      _topbar = opts.topbar;
      _body = opts.body;

      _setFilterValueFromURL(_filterInput, window.location.toString());

      // Filter input bind
      _filterInput.addEventListener('keyup', function(e) {
        // ESC
        if (e.keyCode === 27) {
          this.value = '';
          _filterValue = '';
        } else {
          _filterValue = this.value;
        }
        _setFilterParam(_filterValue, window.location.toString());
        _filterLogs();
      });

      // Log selection dropdown bind
      if (_logSelect) {
        _logSelect.addEventListener('change', function() {
          _sourceFilter = this.value;
          _filterLogs();
        });
      }

      // Pause button bind
      _pauseBtn.addEventListener('mouseup', function() {
        _isPaused = !_isPaused;
        if (_isPaused) {
          this.className += ' play';
        } else {
          _skipCounter = 0;
          this.classList.remove('play');
        }
      });

      // Favicon counter bind
      window.addEventListener(
        'blur',
        function() {
          _isWindowFocused = false;
        },
        true,
      );
      window.addEventListener(
        'focus',
        function() {
          _isWindowFocused = true;
          _faviconReset();
        },
        true,
      );

      // socket.io init
      _socket = opts.socket;
      _socket
        .on('options:lines', function(limit) {
          _linesLimit = limit;
        })
        .on('options:hide-topbar', function() {
          _topbar.className += ' hide';
          _body.className = 'no-topbar';
        })
        .on('options:no-indent', function() {
          _logContainer.className += ' no-indent';
        })
        .on('options:highlightConfig', function(highlightConfig) {
          _highlightConfig = highlightConfig;
        })
        .on('options:files', function(files) {
          _buildFileDropdown(files);
        })
        .on('line', function(data) {
          // a line is either a plain string or { line, source }
          var text = typeof data === 'string' ? data : data.line;
          var source = typeof data === 'string' ? null : data.source;
          if (_isPaused) {
            _skipCounter += 1;
            self.log('==> SKIPPED: ' + _skipCounter + ' <==', (_skipCounter > 1));
          } else {
            self.log(text, false, source);
          }
        });
    },

    /**
     * Log data
     *
     * @param {string} data data to log
     * @param {boolean} replace replace the last line instead of appending
     * @param {string} source name of the file this line came from
     */
    log: function log(data, replace = false, source = null) {
      var wasScrolledBottom = window.innerHeight + Math.ceil(window.pageYOffset + 1)
        >= document.body.offsetHeight;
      var div = document.createElement('div');
      var p = document.createElement('p');
      p.className = 'inner-line';

      // convert ansi color codes to html && escape HTML tags
      data = ansi_up.escape_for_html(data); // eslint-disable-line
      data = ansi_up.ansi_to_html(data); // eslint-disable-line
      p.innerHTML = _highlightWord(data);
      _applySearchHighlight(p);

      div.className = 'line';
      if (source !== null) {
        div.setAttribute('data-source', source);
      }
      div = _highlightLine(data, div);
      div.addEventListener('click', function click() {
        if (this.className.indexOf('selected') === -1) {
          this.className = 'line-selected';
        } else {
          this.className = 'line';
        }
      });

      div.appendChild(p);
      _filterElement(div);
      if (replace) {
        _logContainer.replaceChild(div, _logContainer.lastChild);
      } else {
        _logContainer.appendChild(div);
      }

      if (_logContainer.children.length > _linesLimit) {
        _logContainer.removeChild(_logContainer.children[0]);
      }

      if (wasScrolledBottom) {
        window.scrollTo(0, document.body.scrollHeight);
      }

      _updateFaviconCounter();
    },
  };
}(window, document));
