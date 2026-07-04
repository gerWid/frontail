'use strict';

const fs = require('fs');
// jsdom is pinned to v11 for its legacy old-api used by these browser tests
// eslint-disable-next-line import/extensions
const jsdom = require('jsdom/lib/old-api.js');
const events = require('events');

describe('browser application', () => {
  let io;
  let window;

  function initApp() {
    window.App.init({
      socket: io,
      container: window.document.querySelector('.log'),
      filterInput: window.document.querySelector('#filter'),
      logSelect: window.document.querySelector('#logSelect'),
      brandFiles: window.document.querySelector('#brandFiles'),
      rescanBtn: window.document.querySelector('#rescanBtn'),
      themeLink: window.document.querySelector('.theme-css'),
      themeBtn: window.document.querySelector('#themeBtn'),
      zebraBtn: window.document.querySelector('#zebraBtn'),
      fontIncreaseBtn: window.document.querySelector('#fontIncBtn'),
      fontDecreaseBtn: window.document.querySelector('#fontDecBtn'),
      pauseBtn: window.document.querySelector('#pauseBtn'),
      topbar: window.document.querySelector('.topbar'),
      body: window.document.querySelector('body'),
    });
  }

  function clickOnElement(line) {
    const click = window.document.createEvent('MouseEvents');
    click.initMouseEvent(
      'click',
      true,
      true,
      window,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null
    );
    line.dispatchEvent(click);
  }

  beforeEach((done) => {
    io = new events.EventEmitter();
    const html =
      '<title></title><body><div class="topbar"></div>' +
      '<link class="theme-css" href="styles/dark.css"/>' +
      '<div class="log"></div><button type="button" id="pauseBtn"></button>' +
      '<button type="button" id="themeBtn"></button>' +
      '<button type="button" id="zebraBtn"></button>' +
      '<button type="button" id="fontIncBtn"></button>' +
      '<button type="button" id="fontDecBtn"></button>' +
      '<span id="brandFiles">/log/only.log</span>' +
      '<select id="logSelect" style="display: none;"></select>' +
      '<button type="button" id="rescanBtn" style="display: none;"></button>' +
      '<input type="test" id="filter"/></body>';
    const ansiup = fs.readFileSync('./web/assets/ansi_up.js', 'utf-8');
    const src = fs.readFileSync('./web/assets/app.js', 'utf-8');

    jsdom.env({
      html,
      url: 'http://localhost?filter=line.*',
      src: [ansiup, src],
      onload: (domWindow) => {
        window = domWindow;

        initApp();
        done();
      },
    });
  });

  it('should show lines from socket.io', () => {
    io.emit('line', 'test');

    const log = window.document.querySelector('.log');
    log.childNodes.length.should.be.equal(1);
    log.childNodes[0].textContent.should.be.equal('test');
    log.childNodes[0].className.should.be.equal('line');
    log.childNodes[0].tagName.should.be.equal('DIV');
    log.childNodes[0].innerHTML.should.be.equal(
      '<p class="inner-line">test</p>'
    );
  });

  it('should select line when clicked', () => {
    io.emit('line', 'test');

    const line = window.document.querySelector('.line');
    clickOnElement(line);

    line.className.should.containEql('line-selected');
  });

  it('should deselect line when selected line clicked', () => {
    io.emit('line', 'test');

    const line = window.document.querySelector('.line');
    clickOnElement(line);
    clickOnElement(line);

    line.className.should.not.containEql('line-selected');
  });

  it('should limit number of lines in browser', () => {
    io.emit('options:lines', 2);
    io.emit('line', 'line1');
    io.emit('line', 'line2');
    io.emit('line', 'line3');

    const log = window.document.querySelector('.log');
    log.childNodes.length.should.be.equal(2);
    log.childNodes[0].textContent.should.be.equal('line2');
    log.childNodes[1].textContent.should.be.equal('line3');
  });

  it('should hide topbar', () => {
    io.emit('options:hide-topbar');

    const topbar = window.document.querySelector('.topbar');
    topbar.className.should.match(/hide/);
    const body = window.document.querySelector('body');
    body.className.should.match(/no-topbar/);
  });

  it('should not indent log lines', () => {
    io.emit('options:no-indent');

    const log = window.document.querySelector('.log');
    log.className.should.match(/no-indent/);
  });

  it('should highlight word', () => {
    io.emit('options:highlightConfig', {
      words: {
        foo: 'background: black',
        bar: 'background: black',
      },
    });
    io.emit('line', 'foo bar');

    const line = window.document.querySelector('.line');
    line.innerHTML.should.containEql(
      '<span style="background: black">foo</span> <span style="background: black">bar</span>'
    );
  });

  it('should highlight line', () => {
    io.emit('options:highlightConfig', {
      lines: {
        line: 'background: black',
      },
    });
    io.emit('line', 'line1');

    // the active URL filter `line.*` also wraps the match in a search highlight
    const line = window.document.querySelector('.line');
    line.parentNode.innerHTML.should.equal(
      '<div class="line" style="background: black"><p class="inner-line">' +
        '<span class="search-highlight">line1</span></p></div>'
    );
  });

  it('should highlight search matches in shown lines', () => {
    io.emit('line', 'hello line world');

    const p = window.document.querySelector('.inner-line');
    p.innerHTML.should.containEql('<span class="search-highlight">');
    p.textContent.should.be.equal('hello line world');
  });

  it('should remove search highlight when filter is cleared', () => {
    io.emit('line', 'line1');

    const filterInput = window.document.querySelector('#filter');
    const event = new window.KeyboardEvent('keyup', { keyCode: 27 });
    filterInput.dispatchEvent(event);

    const p = window.document.querySelector('.inner-line');
    p.innerHTML.should.not.containEql('search-highlight');
    p.textContent.should.be.equal('line1');
  });

  it('should show the log dropdown even for a single file', () => {
    const logSelect = window.document.querySelector('#logSelect');

    io.emit('options:files', ['/log/only.log']);
    logSelect.style.display.should.not.be.equal('none');
    // no "All logs" entry needed for a single source
    logSelect.querySelectorAll('option').length.should.be.equal(1);
    logSelect
      .querySelectorAll('option')[0]
      .value.should.be.equal('/log/only.log');
    // the option shows the absolute path, not just the file name
    logSelect
      .querySelectorAll('option')[0]
      .textContent.should.be.equal('/log/only.log');
  });

  it('should replace the static brand file list with the dropdown', () => {
    const brandFiles = window.document.querySelector('#brandFiles');

    io.emit('options:files', ['/log/only.log']);
    brandFiles.style.display.should.be.equal('none');
  });

  it('should offer "All logs" for multiple files', () => {
    const logSelect = window.document.querySelector('#logSelect');

    io.emit('options:files', ['a.log', 'b.log']);
    logSelect.style.display.should.not.be.equal('none');
    logSelect.querySelectorAll('option').length.should.be.equal(3); // All + 2
    logSelect.querySelectorAll('option')[0].value.should.be.equal('all');
  });

  it('should filter lines by the selected source', () => {
    io.emit('options:files', ['a.log', 'b.log']);
    io.emit('line', { line: 'line-a', source: 'a.log' });
    io.emit('line', { line: 'line-b', source: 'b.log' });

    const logSelect = window.document.querySelector('#logSelect');
    logSelect.value = 'b.log';
    const event = window.document.createEvent('Event');
    event.initEvent('change', true, true);
    logSelect.dispatchEvent(event);

    const log = window.document.querySelector('.log');
    log.childNodes.length.should.be.equal(2);
    log.childNodes[0].style.display.should.be.equal('none');
    log.childNodes[1].style.display.should.be.equal('');
  });

  it('should ask the server for a rescan when the button is clicked', () => {
    const btn = window.document.querySelector('#rescanBtn');
    let rescans = 0;
    io.on('rescan', () => {
      rescans += 1;
    });

    io.emit('options:files', ['/log/only.log']);
    // the button appears together with the dropdown
    btn.style.display.should.not.be.equal('none');

    clickOnElement(btn);
    rescans.should.be.equal(1);
  });

  it('should keep the selection when the file list is refreshed', () => {
    const logSelect = window.document.querySelector('#logSelect');
    const event = window.document.createEvent('Event');

    io.emit('options:files', ['a.log', 'b.log'], 'a.log');
    logSelect.value = 'b.log';
    event.initEvent('change', true, true);
    logSelect.dispatchEvent(event);

    // a new file appeared in --log-dir; the server re-sends the list
    io.emit('options:files', ['a.log', 'b.log', 'c.log'], 'a.log');

    logSelect.querySelectorAll('option').length.should.be.equal(4); // All + 3
    logSelect.value.should.be.equal('b.log');
  });

  it('should preselect the default source in the dropdown', () => {
    io.emit('options:files', ['a.log', 'b.log'], 'b.log');
    io.emit('line', { line: 'line-a', source: 'a.log' });
    io.emit('line', { line: 'line-b', source: 'b.log' });

    const logSelect = window.document.querySelector('#logSelect');
    logSelect.value.should.be.equal('b.log');

    const log = window.document.querySelector('.log');
    log.childNodes[0].style.display.should.be.equal('none');
    log.childNodes[1].style.display.should.be.equal('');
  });

  it('should stripe alternate visible lines only', () => {
    io.emit('line', 'line1');
    io.emit('line', 'another'); // hidden by the URL filter `line.*`
    io.emit('line', 'line2');

    const log = window.document.querySelector('.log');
    log.childNodes[0].className.should.not.containEql('zebra-alt');
    log.childNodes[1].className.should.not.containEql('zebra-alt');
    log.childNodes[2].className.should.containEql('zebra-alt');
  });

  it('should toggle zebra mode from the topbar button', () => {
    const btn = window.document.querySelector('#zebraBtn');
    const log = window.document.querySelector('.log');

    clickOnElement(btn);
    log.className.should.containEql('zebra');
    btn.className.should.containEql('tool-active');

    clickOnElement(btn);
    log.className.should.not.containEql('zebra');
  });

  it('should switch theme from the topbar button', () => {
    const btn = window.document.querySelector('#themeBtn');
    const link = window.document.querySelector('.theme-css');

    clickOnElement(btn);
    link.getAttribute('href').should.containEql('default.css');

    clickOnElement(btn);
    link.getAttribute('href').should.containEql('dark.css');
  });

  it('should change the log font size from the topbar buttons', () => {
    const inc = window.document.querySelector('#fontIncBtn');
    const dec = window.document.querySelector('#fontDecBtn');
    const log = window.document.querySelector('.log');

    clickOnElement(inc);
    log.style.fontSize.should.be.equal('0.94em');

    clickOnElement(dec);
    clickOnElement(dec);
    log.style.fontSize.should.be.equal('0.77em');
  });

  it('should escape HTML', () => {
    io.emit('line', '<a/>');

    const line = window.document.querySelector('.line');
    line.innerHTML.should.equal('<p class="inner-line">&lt;a/&gt;</p>');
  });

  it('should work filter from URL', () => {
    io.emit('line', 'line1');
    io.emit('line', 'another');
    io.emit('line', 'line2');

    const filterInput = window.document.querySelector('#filter');
    filterInput.value.should.be.equal('line.*');
    const log = window.document.querySelector('.log');
    log.childNodes.length.should.be.equal(3);
    log.childNodes[0].style.display.should.be.equal('');
    log.childNodes[1].style.display.should.be.equal('none');
    log.childNodes[2].style.display.should.be.equal('');
    window.location.href.should.containEql('filter=line.*');
  });

  it('should clean filter', () => {
    io.emit('line', 'line1');
    io.emit('line', 'another');
    io.emit('line', 'line2');

    const filterInput = window.document.querySelector('#filter');
    const event = new window.KeyboardEvent('keyup', { keyCode: 27 });
    filterInput.dispatchEvent(event);
    const log = window.document.querySelector('.log');
    log.childNodes.length.should.be.equal(3);
    log.childNodes[0].style.display.should.be.equal('');
    log.childNodes[1].style.display.should.be.equal('');
    log.childNodes[2].style.display.should.be.equal('');
    window.location.href.should.be.equal('http://localhost/');
  });

  it('should change filter', () => {
    io.emit('line', 'line1');
    io.emit('line', 'another');
    io.emit('line', 'line2');

    const log = window.document.querySelector('.log');
    const filterInput = window.document.querySelector('#filter');
    filterInput.value = 'other';
    const event = new window.KeyboardEvent('keyup', { keyCode: 13 });
    filterInput.dispatchEvent(event);
    log.childNodes.length.should.be.equal(3);
    log.childNodes[0].style.display.should.be.equal('none');
    log.childNodes[1].style.display.should.be.equal('');
    log.childNodes[2].style.display.should.be.equal('none');
    window.location.href.should.containEql('filter=other');
  });

  it('should pause', () => {
    io.emit('line', 'line1');
    const btn = window.document.querySelector('#pauseBtn');
    const event = window.document.createEvent('Event');
    event.initEvent('mouseup', true, true);
    btn.dispatchEvent(event);
    io.emit('line', 'line2');
    io.emit('line', 'line3');

    btn.className.should.containEql('play');
    const log = window.document.querySelector('.log');
    log.childNodes.length.should.be.equal(2);
    log.lastChild.textContent.should.be.equal('==> SKIPPED: 2 <==');
  });

  it('should play', () => {
    const btn = window.document.querySelector('#pauseBtn');
    const event = window.document.createEvent('Event');
    event.initEvent('mouseup', true, true);
    btn.dispatchEvent(event);
    io.emit('line', 'line1');
    const log = window.document.querySelector('.log');
    log.childNodes.length.should.be.equal(1);
    log.lastChild.textContent.should.be.equal('==> SKIPPED: 1 <==');
    btn.className.should.containEql('play');
    btn.dispatchEvent(event);
    io.emit('line', 'line2');

    btn.className.should.not.containEql('play');
    log.childNodes.length.should.be.equal(2);
    log.lastChild.textContent.should.be.equal('line2');
  });
});
