/* ============================================================
   JOURNAL 댓글 (Firebase Firestore)
   ------------------------------------------------------------
   - firebase-config.js 가 설정되기 전에는 "준비 중" 안내만 표시
   - 사용자 입력은 전부 textContent 로만 렌더링 (XSS 차단)
   - 스팸 방지: honeypot 필드 + 30초 등록 간격 + 글자수 제한
   - 수정/삭제는 클라이언트에서 불가 (Firestore 규칙) — 삭제는
     Firebase 콘솔에서. FIREBASE-SETUP.md 참고
   ============================================================ */

(function () {
  var FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var MAX_NAME = 20;
  var MAX_MESSAGE = 800;
  var MIN_INTERVAL_MS = 30 * 1000;
  var LS_KEY = 'journal_last_comment_at';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* \n 을 <br>로 살리되 텍스트는 안전하게 삽입 */
  function fillMultiline(node, text) {
    var lines = String(text).split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (i > 0) node.appendChild(document.createElement('br'));
      node.appendChild(document.createTextNode(lines[i]));
    }
  }

  function formatDate(date) {
    return date.getFullYear() + '. ' + (date.getMonth() + 1) + '. ' + date.getDate();
  }

  function configReady(cfg) {
    if (!cfg) return false;
    for (var key in cfg) {
      if (typeof cfg[key] !== 'string' || cfg[key] === '' || cfg[key].indexOf('여기에') !== -1) return false;
    }
    return true;
  }

  async function init() {
    var root = document.getElementById('comments-app');
    if (!root) return;
    var postId = root.getAttribute('data-post-id');
    var statusEl = root.querySelector('.comments-status');
    var listEl = root.querySelector('.comments-list');
    var form = root.querySelector('form.comment-form');

    function setStatus(message) {
      statusEl.textContent = message || '';
      statusEl.style.display = message ? '' : 'none';
    }

    if (!postId) return;

    if (!configReady(window.FIREBASE_CONFIG)) {
      form.style.display = 'none';
      setStatus('댓글 기능은 준비 중입니다.');
      return;
    }

    var db, fs;
    try {
      var app = await import(FIREBASE_CDN + 'firebase-app.js');
      fs = await import(FIREBASE_CDN + 'firebase-firestore.js');
      db = fs.getFirestore(app.initializeApp(window.FIREBASE_CONFIG));
    } catch (err) {
      form.style.display = 'none';
      setStatus('댓글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    function renderComment(name, message, date, prepend) {
      var item = el('div', 'comment');
      var meta = el('div', 'comment-meta');
      meta.appendChild(el('span', 'comment-name', name || '익명'));
      if (date) meta.appendChild(el('span', 'comment-date', formatDate(date)));
      var body = el('div', 'comment-body');
      fillMultiline(body, message);
      item.appendChild(meta);
      item.appendChild(body);
      if (prepend && listEl.firstChild) listEl.insertBefore(item, listEl.firstChild);
      else listEl.appendChild(item);
    }

    async function loadComments() {
      setStatus('댓글을 불러오는 중…');
      try {
        /* 복합 인덱스 없이 동작하도록 정렬은 클라이언트에서 */
        var snap = await fs.getDocs(fs.query(
          fs.collection(db, 'comments'),
          fs.where('postId', '==', postId)
        ));
        var rows = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          rows.push({
            name: typeof d.name === 'string' ? d.name : '익명',
            message: typeof d.message === 'string' ? d.message : '',
            createdAt: d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : null
          });
        });
        rows.sort(function (a, b) {
          return (a.createdAt ? a.createdAt.getTime() : 0) - (b.createdAt ? b.createdAt.getTime() : 0);
        });
        listEl.textContent = '';
        rows.forEach(function (row) {
          if (row.message) renderComment(row.name, row.message, row.createdAt);
        });
        setStatus(rows.length ? '' : '아직 남겨진 글이 없습니다. 첫 마음을 남겨 주세요.');
      } catch (err) {
        setStatus('댓글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var nameInput = form.querySelector('input[name="name"]');
      var messageInput = form.querySelector('textarea[name="message"]');
      var honeypot = form.querySelector('input[name="website"]');
      var button = form.querySelector('button[type="submit"]');
      var noteEl = form.querySelector('.form-note');

      function setNote(message) { noteEl.textContent = message || ''; }

      /* honeypot: 봇이 채우는 숨은 칸 — 채워져 있으면 조용히 무시 */
      if (honeypot && honeypot.value) { messageInput.value = ''; return; }

      var name = nameInput.value.trim().slice(0, MAX_NAME);
      var message = messageInput.value.trim();
      if (!message) { setNote('내용을 입력해 주세요.'); return; }
      if (message.length > MAX_MESSAGE) { setNote('댓글은 ' + MAX_MESSAGE + '자 이내로 남겨 주세요.'); return; }

      var last = Number(localStorage.getItem(LS_KEY) || 0);
      if (Date.now() - last < MIN_INTERVAL_MS) {
        setNote('잠시 후 다시 남겨 주세요.');
        return;
      }

      button.disabled = true;
      setNote('등록 중…');
      try {
        await fs.addDoc(fs.collection(db, 'comments'), {
          postId: postId,
          name: name || '익명',
          message: message,
          createdAt: fs.serverTimestamp()
        });
        localStorage.setItem(LS_KEY, String(Date.now()));
        renderComment(name || '익명', message, new Date());
        messageInput.value = '';
        setNote('');
        setStatus('');
      } catch (err) {
        setNote('등록에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        button.disabled = false;
      }
    });

    loadComments();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
