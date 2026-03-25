// drag.js — HTML5 drag-and-drop between columns

const Drag = (() => {
  let draggingCardId = null;
  let draggingFromColId = null;
  let dragPlaceholder = null;
  let boardId = null;

  function init(bid) {
    boardId = bid;
  }

  function makeDraggable(cardEl, cardId, colId) {
    cardEl.setAttribute('draggable', 'true');

    cardEl.addEventListener('dragstart', e => {
      draggingCardId = cardId;
      draggingFromColId = colId;
      cardEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cardId);

      // Create placeholder
      dragPlaceholder = document.createElement('div');
      dragPlaceholder.className = 'drag-placeholder';
      dragPlaceholder.style.height = cardEl.offsetHeight + 'px';
    });

    cardEl.addEventListener('dragend', () => {
      cardEl.classList.remove('dragging');
      if (dragPlaceholder && dragPlaceholder.parentNode) {
        dragPlaceholder.parentNode.removeChild(dragPlaceholder);
      }
      dragPlaceholder = null;
      draggingCardId = null;
      draggingFromColId = null;
      // Remove all column highlights
      document.querySelectorAll('.column--drag-over').forEach(el => el.classList.remove('column--drag-over'));
    });
  }

  function makeDropTarget(colBody, colId, onDrop) {
    colBody.addEventListener('dragover', e => {
      if (!draggingCardId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const col = colBody.closest('.column');
      document.querySelectorAll('.column--drag-over').forEach(el => el.classList.remove('column--drag-over'));
      col.classList.add('column--drag-over');

      // Move placeholder to correct position
      const afterEl = getDragAfterElement(colBody, e.clientY);
      if (dragPlaceholder) {
        if (afterEl) {
          colBody.insertBefore(dragPlaceholder, afterEl);
        } else {
          colBody.appendChild(dragPlaceholder);
        }
      }
    });

    colBody.addEventListener('dragleave', e => {
      if (!colBody.contains(e.relatedTarget)) {
        colBody.closest('.column').classList.remove('column--drag-over');
      }
    });

    colBody.addEventListener('drop', e => {
      e.preventDefault();
      if (!draggingCardId) return;

      const col = colBody.closest('.column');
      col.classList.remove('column--drag-over');

      const afterEl = dragPlaceholder && dragPlaceholder.parentNode === colBody
        ? dragPlaceholder.nextElementSibling
        : getDragAfterElement(colBody, e.clientY);

      // Calculate index
      const cards = [...colBody.querySelectorAll('.card:not(.dragging)')];
      let toIndex = cards.length;
      if (afterEl && afterEl.classList.contains('card')) {
        toIndex = cards.indexOf(afterEl);
        if (toIndex === -1) toIndex = cards.length;
      }

      if (dragPlaceholder && dragPlaceholder.parentNode) {
        dragPlaceholder.parentNode.removeChild(dragPlaceholder);
      }

      onDrop(draggingCardId, draggingFromColId, colId, toIndex);
    });
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll('.card:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  return { init, makeDraggable, makeDropTarget };
})();
