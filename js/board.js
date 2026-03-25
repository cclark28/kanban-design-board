// board.js — board/column/card rendering + interactions

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const boardId = params.get('id');
  if (!boardId) { window.location.href = 'index.html'; return; }

  let boardData = Storage.getBoardData(boardId);
  if (!boardData) { window.location.href = 'index.html'; return; }

  // Undo stack for card deletes
  let undoStack = [];
  let searchQuery = '';
  let filterTagId = '';

  Drag.init(boardId);

  Modal.init(boardId,
    // onSave
    (colId, cardId, cardData) => {
      if (cardId) {
        Storage.updateCard(boardId, colId, cardId, cardData);
      } else {
        Storage.addCard(boardId, colId, cardData);
      }
      reload();
    },
    // onDelete
    (colId, cardId) => {
      const removed = Storage.deleteCard(boardId, colId, cardId);
      if (removed) undoStack.push({ colId, card: removed });
      reload();
    }
  );

  function reload() {
    boardData = Storage.getBoardData(boardId);
    renderBoard();
  }

  // Header
  const titleEl = document.getElementById('board-title');
  titleEl.textContent = boardData.name;
  titleEl.addEventListener('blur', () => {
    const newName = titleEl.textContent.trim() || boardData.name;
    titleEl.textContent = newName;
    Storage.updateBoard(boardId, { name: newName });
    const data = Storage.getBoardData(boardId);
    if (data) { data.name = newName; Storage.saveBoardData(data); }
    boardData.name = newName;
  });
  titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } });

  document.getElementById('back-btn').addEventListener('click', () => { window.location.href = 'index.html'; });

  // Search
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.toLowerCase();
    renderBoard();
  });

  // Tag filter
  const tagFilter = document.getElementById('tag-filter');
  tagFilter.addEventListener('change', () => {
    filterTagId = tagFilter.value;
    renderBoard();
  });

  // Export
  document.getElementById('export-btn').addEventListener('click', () => {
    const json = Storage.exportBoard(boardId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(boardData.name)}-board.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Add column
  document.getElementById('add-column-btn').addEventListener('click', () => {
    const title = prompt('Column title:');
    if (!title || !title.trim()) return;
    Storage.addColumn(boardId, title.trim());
    reload();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;

    if (!inInput && e.key === '/') {
      e.preventDefault();
      searchInput.focus();
      return;
    }
    if (!inInput && e.key === 'n') {
      const firstCol = boardData.columns[0];
      if (firstCol) openNewCard(firstCol.id);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      if (undoStack.length) {
        const { colId, card } = undoStack.pop();
        const col = boardData.columns.find(c => c.id === colId);
        if (col) {
          col.cards.push(card);
          Storage.saveBoardData(boardData);
          reload();
          showToast('Card restored');
        }
      }
    }
  });

  // Paste image anywhere on board
  document.addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const imageItem = [...items].find(i => i.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    Modal.compressImage(file, dataUrl => {
      // If modal is already open, just set the image
      if (!document.getElementById('card-modal').hidden) {
        Modal.setImage(dataUrl);
        return;
      }
      // Pick first column or prompt
      const col = boardData.columns[0];
      if (!col) { showToast('Add a column first', true); return; }
      openNewCard(col.id, dataUrl);
    });
  });

  function openNewCard(colId, prefilledImage) {
    const card = { id: null, title: '', image: prefilledImage || '', notes: '', sourceUrl: '', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    Modal.open(colId, card, boardData.tags);
    if (prefilledImage) Modal.setImage(prefilledImage);
  }

  // Main render
  function renderBoard() {
    const board = Storage.getBoardData(boardId);
    if (!board) return;
    boardData = board;

    updateTagFilter();

    const container = document.getElementById('columns-container');
    container.innerHTML = '';

    boardData.columns.forEach(col => {
      const colEl = renderColumn(col);
      container.appendChild(colEl);
    });
  }

  function updateTagFilter() {
    tagFilter.innerHTML = '<option value="">All tags</option>';
    boardData.tags.forEach(tag => {
      const opt = document.createElement('option');
      opt.value = tag.id;
      opt.textContent = tag.name;
      if (tag.id === filterTagId) opt.selected = true;
      tagFilter.appendChild(opt);
    });
  }

  function renderColumn(col) {
    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.dataset.colId = col.id;

    // Filter cards
    let cards = col.cards;
    if (searchQuery) {
      cards = cards.filter(c =>
        c.title.toLowerCase().includes(searchQuery) ||
        c.notes.toLowerCase().includes(searchQuery)
      );
    }
    if (filterTagId) {
      cards = cards.filter(c => c.tags.includes(filterTagId));
    }

    colEl.innerHTML = `
      <div class="column__header" style="--col-color:${col.color}">
        <div class="column__header-left">
          <div class="column__color-dot" style="background:${col.color}"></div>
          <span class="column__title" contenteditable="true" spellcheck="false">${escapeHtml(col.title)}</span>
          <span class="column__count">${cards.length}</span>
        </div>
        <div class="column__header-right">
          <button class="column__menu-btn icon-btn" title="Column options">
            <span class="material-icons md-16">more_vert</span>
          </button>
        </div>
      </div>
      <div class="column__body"></div>
      <div class="column__footer">
        <button class="add-card-btn">
          <span class="material-icons md-14">add</span>
          Add Card
        </button>
      </div>
    `;

    // Title editing
    const titleEl = colEl.querySelector('.column__title');
    titleEl.addEventListener('blur', () => {
      const newTitle = titleEl.textContent.trim() || col.title;
      titleEl.textContent = newTitle;
      Storage.updateColumn(boardId, col.id, { title: newTitle });
      boardData = Storage.getBoardData(boardId);
    });
    titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } });

    // Column menu
    colEl.querySelector('.column__menu-btn').addEventListener('click', e => {
      showColumnMenu(col, e.currentTarget);
    });

    // Add card
    colEl.querySelector('.add-card-btn').addEventListener('click', () => openNewCard(col.id));

    // Render cards
    const body = colEl.querySelector('.column__body');
    cards.forEach(card => {
      const cardEl = renderCard(card, col);
      body.appendChild(cardEl);
    });

    // Drop target
    Drag.makeDropTarget(body, col.id, (cardId, fromColId, toColId, toIndex) => {
      Storage.moveCard(boardId, fromColId, toColId, cardId, toIndex);
      reload();
    });

    return colEl;
  }

  function renderCard(card, col) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.cardId = card.id;

    const isStale = isCardStale(card);
    if (isStale) cardEl.classList.add('card--stale');

    const tagDefs = boardData.tags.filter(t => card.tags.includes(t.id));

    cardEl.innerHTML = `
      ${card.image ? `<div class="card__image-wrap"><img class="card__image" src="${card.image}" alt="" loading="lazy"></div>` : ''}
      <div class="card__body">
        <div class="card__title">${escapeHtml(card.title)}</div>
        ${card.notes ? `<div class="card__notes">${escapeHtml(truncate(card.notes, 100))}</div>` : ''}
        ${tagDefs.length ? `<div class="card__tags">${tagDefs.map(t => `<span class="tag-pill" style="--tag-color:${t.color}">${escapeHtml(t.name)}</span>`).join('')}</div>` : ''}
        <div class="card__meta">${formatRelativeDate(card.updatedAt)}</div>
      </div>
    `;

    cardEl.addEventListener('click', () => {
      Modal.open(col.id, card, boardData.tags);
    });

    Drag.makeDraggable(cardEl, card.id, col.id);

    return cardEl;
  }

  function showColumnMenu(col, anchor) {
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <button data-action="recolor">Change color</button>
      <button data-action="delete" class="danger">Delete column</button>
    `;
    document.body.appendChild(menu);
    activeMenu = menu;

    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4 + window.scrollY}px`;
    menu.style.left = `${rect.left + window.scrollX - menu.offsetWidth + rect.width}px`;

    menu.addEventListener('click', e => {
      const action = e.target.dataset.action;
      if (!action) return;
      closeContextMenu();

      if (action === 'recolor') {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = col.color;
        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
        input.addEventListener('change', () => {
          Storage.updateColumn(boardId, col.id, { color: input.value });
          document.body.removeChild(input);
          reload();
        });
        input.addEventListener('blur', () => setTimeout(() => document.body.contains(input) && document.body.removeChild(input), 200));
      } else if (action === 'delete') {
        const col2 = boardData.columns.find(c => c.id === col.id);
        if (col2 && col2.cards.length > 0) {
          if (!confirm(`Delete column "${col.title}" and its ${col2.cards.length} card(s)?`)) return;
        }
        Storage.deleteColumn(boardId, col.id);
        reload();
      }
    });
  }

  let activeMenu = null;

  function closeContextMenu() {
    if (activeMenu) { activeMenu.remove(); activeMenu = null; }
  }

  document.addEventListener('click', e => {
    if (activeMenu && !activeMenu.contains(e.target)) closeContextMenu();
  }, true);

  // Helpers
  function isCardStale(card) {
    const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
    return (Date.now() - new Date(card.updatedAt).getTime()) > MS_30_DAYS;
  }

  function formatRelativeDate(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  function truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  function showToast(msg, isError = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' toast--error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('toast--show'), 10);
    setTimeout(() => { t.classList.remove('toast--show'); setTimeout(() => t.remove(), 300); }, 2500);
  }

  // Initial render
  renderBoard();
});

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
