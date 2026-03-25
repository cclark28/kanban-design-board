// home.js — home screen logic

document.addEventListener('DOMContentLoaded', () => {
  renderBoards();
  setupNewBoardButton();
  setupImportDrop();
});

function renderBoards() {
  const grid = document.getElementById('boards-grid');
  const empty = document.getElementById('empty-state');
  const boards = Storage.getBoards();

  grid.innerHTML = '';

  if (boards.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  boards.forEach(board => {
    const count = Storage.getCardCount(board.id);
    const tile = document.createElement('div');
    tile.className = 'board-tile';
    tile.dataset.id = board.id;
    tile.innerHTML = `
      <div class="board-tile__accent" style="background:${board.color}"></div>
      <div class="board-tile__body">
        <div class="board-tile__name">${escapeHtml(board.name)}</div>
        <div class="board-tile__meta">${count} card${count !== 1 ? 's' : ''}</div>
      </div>
      <button class="board-tile__menu-btn" aria-label="Board menu" title="Board options">
        <span class="material-icons md-16">more_vert</span>
      </button>
    `;

    tile.addEventListener('click', e => {
      if (!e.target.closest('.board-tile__menu-btn')) {
        window.location.href = `board.html?id=${board.id}`;
      }
    });

    tile.querySelector('.board-tile__menu-btn').addEventListener('click', e => {
      e.stopPropagation();
      showBoardMenu(board, tile.querySelector('.board-tile__menu-btn'));
    });

    grid.appendChild(tile);
  });
}

function setupNewBoardButton() {
  document.getElementById('new-board-btn').addEventListener('click', () => {
    showNewBoardDialog();
  });
}

function showNewBoardDialog() {
  const dialog = document.getElementById('new-board-dialog');
  dialog.querySelector('#new-board-name').value = '';
  dialog.querySelector('#new-board-color').value = randomAccentColor();
  dialog.hidden = false;
  dialog.querySelector('#new-board-name').focus();
}

function hideNewBoardDialog() {
  document.getElementById('new-board-dialog').hidden = true;
}

document.addEventListener('click', e => {
  if (e.target.id === 'new-board-cancel') hideNewBoardDialog();
  if (e.target.id === 'new-board-submit') {
    const name = document.getElementById('new-board-name').value.trim();
    if (!name) { document.getElementById('new-board-name').focus(); return; }
    const color = document.getElementById('new-board-color').value;
    const board = Storage.createBoard(name, color);
    hideNewBoardDialog();
    window.location.href = `board.html?id=${board.id}`;
  }
  if (e.target.classList.contains('dialog-backdrop')) {
    hideNewBoardDialog();
    closeContextMenu();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideNewBoardDialog();
    closeContextMenu();
  }
  if (e.key === 'Enter' && !document.getElementById('new-board-dialog').hidden) {
    document.getElementById('new-board-submit').click();
  }
});

// Context menu for board tiles
let activeMenu = null;

function showBoardMenu(board, anchor) {
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <button data-action="rename">Rename</button>
    <button data-action="recolor">Change color</button>
    <button data-action="export">Export JSON</button>
    <button data-action="delete" class="danger">Delete</button>
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

    if (action === 'rename') {
      const newName = prompt('Board name:', board.name);
      if (newName && newName.trim()) {
        Storage.updateBoard(board.id, { name: newName.trim() });
        const data = Storage.getBoardData(board.id);
        if (data) { data.name = newName.trim(); Storage.saveBoardData(data); }
        renderBoards();
      }
    } else if (action === 'recolor') {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = board.color;
      input.style.display = 'none';
      document.body.appendChild(input);
      input.click();
      input.addEventListener('change', () => {
        Storage.updateBoard(board.id, { color: input.value });
        document.body.removeChild(input);
        renderBoards();
      });
      input.addEventListener('blur', () => {
        setTimeout(() => document.body.contains(input) && document.body.removeChild(input), 200);
      });
    } else if (action === 'export') {
      const json = Storage.exportBoard(board.id);
      downloadJson(json, `${slugify(board.name)}-board.json`);
    } else if (action === 'delete') {
      if (confirm(`Delete board "${board.name}"? This cannot be undone.`)) {
        Storage.deleteBoard(board.id);
        renderBoards();
      }
    }
  });
}

function closeContextMenu() {
  if (activeMenu) { activeMenu.remove(); activeMenu = null; }
}

document.addEventListener('click', e => {
  if (activeMenu && !activeMenu.contains(e.target)) closeContextMenu();
}, true);

// Import via drag-and-drop JSON onto page
function setupImportDrop() {
  const drop = document.getElementById('import-drop');

  document.addEventListener('dragover', e => {
    if ([...e.dataTransfer.items].some(i => i.type === 'application/json' || i.type === 'text/plain')) {
      e.preventDefault();
      drop.hidden = false;
    }
  });

  document.addEventListener('dragleave', e => {
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      drop.hidden = true;
    }
  });

  document.addEventListener('drop', e => {
    drop.hidden = true;
    const file = [...e.dataTransfer.files].find(f => f.name.endsWith('.json'));
    if (!file) return;
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const board = Storage.importBoard(reader.result);
        renderBoards();
        showToast(`Imported "${board.name}"`);
      } catch {
        showToast('Failed to import — invalid JSON', true);
      }
    };
    reader.readAsText(file);
  });
}

// Utilities
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function downloadJson(json, filename) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function randomAccentColor() {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' toast--error' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast--show'), 10);
  setTimeout(() => { t.classList.remove('toast--show'); setTimeout(() => t.remove(), 300); }, 2500);
}
