// storage.js — localStorage CRUD abstraction

const Storage = (() => {
  const BOARDS_KEY = 'kb_boards';

  function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Board list
  function getBoards() {
    try {
      return JSON.parse(localStorage.getItem(BOARDS_KEY) || '[]');
    } catch { return []; }
  }

  function saveBoards(boards) {
    localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
  }

  function createBoard(name, color) {
    const boards = getBoards();
    const board = {
      id: generateId(),
      name,
      color: color || '#6366f1',
      createdAt: new Date().toISOString(),
    };
    boards.push(board);
    saveBoards(boards);
    // Init board data
    saveBoardData({
      id: board.id,
      name,
      columns: [],
      tags: [],
    });
    return board;
  }

  function updateBoard(id, updates) {
    const boards = getBoards();
    const idx = boards.findIndex(b => b.id === id);
    if (idx === -1) return null;
    boards[idx] = { ...boards[idx], ...updates };
    saveBoards(boards);
    return boards[idx];
  }

  function deleteBoard(id) {
    const boards = getBoards().filter(b => b.id !== id);
    saveBoards(boards);
    localStorage.removeItem(`kb_board_${id}`);
  }

  // Board data
  function getBoardData(id) {
    try {
      return JSON.parse(localStorage.getItem(`kb_board_${id}`) || 'null');
    } catch { return null; }
  }

  function saveBoardData(data) {
    localStorage.setItem(`kb_board_${data.id}`, JSON.stringify(data));
  }

  // Column operations
  function addColumn(boardId, title, color) {
    const data = getBoardData(boardId);
    if (!data) return null;
    const col = {
      id: generateId(),
      title,
      color: color || '#f1f5f9',
      cards: [],
    };
    data.columns.push(col);
    saveBoardData(data);
    return col;
  }

  function updateColumn(boardId, colId, updates) {
    const data = getBoardData(boardId);
    if (!data) return null;
    const col = data.columns.find(c => c.id === colId);
    if (!col) return null;
    Object.assign(col, updates);
    saveBoardData(data);
    return col;
  }

  function deleteColumn(boardId, colId) {
    const data = getBoardData(boardId);
    if (!data) return;
    data.columns = data.columns.filter(c => c.id !== colId);
    saveBoardData(data);
  }

  function reorderColumns(boardId, newOrder) {
    const data = getBoardData(boardId);
    if (!data) return;
    const map = Object.fromEntries(data.columns.map(c => [c.id, c]));
    data.columns = newOrder.map(id => map[id]).filter(Boolean);
    saveBoardData(data);
  }

  // Card operations
  function addCard(boardId, colId, cardData) {
    const data = getBoardData(boardId);
    if (!data) return null;
    const col = data.columns.find(c => c.id === colId);
    if (!col) return null;
    const card = {
      id: generateId(),
      title: cardData.title || 'Untitled',
      image: cardData.image || '',
      notes: cardData.notes || '',
      sourceUrl: cardData.sourceUrl || '',
      tags: cardData.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    col.cards.push(card);
    saveBoardData(data);
    updateBoardMeta(boardId, data);
    return card;
  }

  function updateCard(boardId, colId, cardId, updates) {
    const data = getBoardData(boardId);
    if (!data) return null;
    const col = data.columns.find(c => c.id === colId);
    if (!col) return null;
    const card = col.cards.find(c => c.id === cardId);
    if (!card) return null;
    Object.assign(card, updates, { updatedAt: new Date().toISOString() });
    saveBoardData(data);
    return card;
  }

  function deleteCard(boardId, colId, cardId) {
    const data = getBoardData(boardId);
    if (!data) return null;
    const col = data.columns.find(c => c.id === colId);
    if (!col) return null;
    const idx = col.cards.findIndex(c => c.id === cardId);
    if (idx === -1) return null;
    const [removed] = col.cards.splice(idx, 1);
    saveBoardData(data);
    updateBoardMeta(boardId, data);
    return removed;
  }

  function moveCard(boardId, fromColId, toColId, cardId, toIndex) {
    const data = getBoardData(boardId);
    if (!data) return;
    const fromCol = data.columns.find(c => c.id === fromColId);
    const toCol = data.columns.find(c => c.id === toColId);
    if (!fromCol || !toCol) return;
    const cardIdx = fromCol.cards.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return;
    const [card] = fromCol.cards.splice(cardIdx, 1);
    const insertAt = (toIndex != null && toIndex >= 0) ? Math.min(toIndex, toCol.cards.length) : toCol.cards.length;
    toCol.cards.splice(insertAt, 0, card);
    saveBoardData(data);
  }

  function reorderCard(boardId, colId, cardId, toIndex) {
    moveCard(boardId, colId, colId, cardId, toIndex);
  }

  // Tag operations
  function addTag(boardId, name, color) {
    const data = getBoardData(boardId);
    if (!data) return null;
    const tag = { id: generateId(), name, color: color || '#e0f2fe' };
    data.tags.push(tag);
    saveBoardData(data);
    return tag;
  }

  function updateTag(boardId, tagId, updates) {
    const data = getBoardData(boardId);
    if (!data) return null;
    const tag = data.tags.find(t => t.id === tagId);
    if (!tag) return null;
    Object.assign(tag, updates);
    saveBoardData(data);
    return tag;
  }

  function deleteTag(boardId, tagId) {
    const data = getBoardData(boardId);
    if (!data) return;
    data.tags = data.tags.filter(t => t.id !== tagId);
    // Remove from all cards
    data.columns.forEach(col => col.cards.forEach(card => {
      card.tags = card.tags.filter(t => t !== tagId);
    }));
    saveBoardData(data);
  }

  // Board card count helper
  function updateBoardMeta(boardId, data) {
    const boards = getBoards();
    const board = boards.find(b => b.id === boardId);
    if (board) {
      board.updatedAt = new Date().toISOString();
      saveBoards(boards);
    }
  }

  function getCardCount(boardId) {
    const data = getBoardData(boardId);
    if (!data) return 0;
    return data.columns.reduce((sum, col) => sum + col.cards.length, 0);
  }

  // Export/Import
  function exportBoard(boardId) {
    const board = getBoards().find(b => b.id === boardId);
    const data = getBoardData(boardId);
    return JSON.stringify({ board, data }, null, 2);
  }

  function importBoard(jsonStr) {
    const { board, data } = JSON.parse(jsonStr);
    // Give new IDs to avoid conflicts
    const newId = generateId();
    const oldId = board.id;
    board.id = newId;
    board.name = board.name + ' (imported)';
    data.id = newId;

    // Remap old IDs in cards (tags etc.)
    const boards = getBoards();
    boards.push(board);
    saveBoards(boards);
    saveBoardData(data);
    return board;
  }

  return {
    generateId,
    getBoards, saveBoards, createBoard, updateBoard, deleteBoard,
    getBoardData, saveBoardData,
    addColumn, updateColumn, deleteColumn, reorderColumns,
    addCard, updateCard, deleteCard, moveCard, reorderCard,
    addTag, updateTag, deleteTag,
    getCardCount, exportBoard, importBoard,
  };
})();
