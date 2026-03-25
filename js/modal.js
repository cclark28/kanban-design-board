// modal.js — card detail modal + lightbox

const Modal = (() => {
  let currentBoardId = null;
  let currentColId = null;
  let currentCardId = null;
  let onSaveCallback = null;
  let onDeleteCallback = null;

  function init(boardId, onSave, onDelete) {
    currentBoardId = boardId;
    onSaveCallback = onSave;
    onDeleteCallback = onDelete;
    setupListeners();
  }

  function open(colId, card, tags) {
    currentColId = colId;
    currentCardId = card ? card.id : null;

    const modal = document.getElementById('card-modal');
    modal.querySelector('#modal-title').value = card ? card.title : '';
    modal.querySelector('#modal-notes').value = card ? card.notes : '';
    modal.querySelector('#modal-source-url').value = card ? card.sourceUrl : '';
    modal.querySelector('#modal-image-preview').src = card && card.image ? card.image : '';
    modal.querySelector('#modal-image-preview').hidden = !(card && card.image);
    modal.querySelector('#modal-no-image').hidden = !!(card && card.image);
    modal.querySelector('#modal-remove-image').hidden = !(card && card.image);

    if (card) {
      const created = new Date(card.createdAt).toLocaleString();
      const updated = new Date(card.updatedAt).toLocaleString();
      modal.querySelector('#modal-timestamps').textContent = `Created ${created} · Updated ${updated}`;
    } else {
      modal.querySelector('#modal-timestamps').textContent = '';
    }

    renderTagPicker(card ? card.tags : [], tags);

    modal.hidden = false;
    modal.querySelector('#modal-title').focus();

    // Store image separately for access during save
    modal._pendingImage = card ? card.image : '';
  }

  function close() {
    document.getElementById('card-modal').hidden = true;
    currentCardId = null;
    currentColId = null;
  }

  function setImage(dataUrl) {
    const modal = document.getElementById('card-modal');
    modal._pendingImage = dataUrl;
    const preview = modal.querySelector('#modal-image-preview');
    preview.src = dataUrl;
    preview.hidden = false;
    modal.querySelector('#modal-no-image').hidden = true;
    modal.querySelector('#modal-remove-image').hidden = false;
  }

  function renderTagPicker(selectedIds, allTags) {
    const container = document.getElementById('modal-tag-picker');
    container.innerHTML = '';

    allTags.forEach(tag => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'tag-pill' + (selectedIds.includes(tag.id) ? ' tag-pill--selected' : '');
      pill.style.setProperty('--tag-color', tag.color);
      pill.textContent = tag.name;
      pill.dataset.tagId = tag.id;
      pill.addEventListener('click', () => pill.classList.toggle('tag-pill--selected'));
      container.appendChild(pill);
    });

    // "New tag" button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'tag-pill tag-pill--add';
    addBtn.textContent = '+ New tag';
    addBtn.addEventListener('click', () => showNewTagForm(container, allTags));
    container.appendChild(addBtn);
  }

  function showNewTagForm(container, allTags) {
    const existing = container.querySelector('.new-tag-form');
    if (existing) { existing.querySelector('input').focus(); return; }

    const form = document.createElement('div');
    form.className = 'new-tag-form';
    form.innerHTML = `
      <input type="text" placeholder="Tag name" maxlength="30" class="new-tag-input">
      <input type="color" class="new-tag-color" value="#6366f1">
      <button type="button" class="btn btn--sm">Add</button>
    `;
    container.appendChild(form);
    form.querySelector('.new-tag-input').focus();

    form.querySelector('.btn').addEventListener('click', () => {
      const name = form.querySelector('.new-tag-input').value.trim();
      const color = form.querySelector('.new-tag-color').value;
      if (!name) return;
      const tag = Storage.addTag(currentBoardId, name, color);
      allTags.push(tag);
      form.remove();
      // Re-render with new tag selected
      const selectedIds = getSelectedTagIds();
      selectedIds.push(tag.id);
      renderTagPicker(selectedIds, allTags);
    });

    form.querySelector('.new-tag-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') form.querySelector('.btn').click();
      if (e.key === 'Escape') form.remove();
    });
  }

  function getSelectedTagIds() {
    return [...document.querySelectorAll('.tag-pill--selected')].map(el => el.dataset.tagId).filter(Boolean);
  }

  function setupListeners() {
    const modal = document.getElementById('card-modal');

    // Image click → lightbox
    modal.querySelector('#modal-image-preview').addEventListener('click', e => {
      e.stopPropagation();
      const src = modal.querySelector('#modal-image-preview').src;
      if (src) openLightbox(src);
    });

    // Image drop onto modal
    modal.addEventListener('dragover', e => {
      const file = [...(e.dataTransfer.items || [])].find(i => i.type.startsWith('image/'));
      if (file) { e.preventDefault(); modal.classList.add('modal--drag-over'); }
    });
    modal.addEventListener('dragleave', () => modal.classList.remove('modal--drag-over'));
    modal.addEventListener('drop', e => {
      modal.classList.remove('modal--drag-over');
      const file = [...(e.dataTransfer.files || [])].find(f => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        compressImage(file, dataUrl => setImage(dataUrl));
      }
    });

    // File input
    modal.querySelector('#modal-image-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) compressImage(file, dataUrl => setImage(dataUrl));
      e.target.value = '';
    });

    modal.querySelector('#modal-image-label').addEventListener('click', e => {
      if (e.target.id === 'modal-remove-image') return;
      modal.querySelector('#modal-image-file').click();
    });

    // Remove image
    modal.querySelector('#modal-remove-image').addEventListener('click', e => {
      e.stopPropagation();
      modal._pendingImage = '';
      modal.querySelector('#modal-image-preview').src = '';
      modal.querySelector('#modal-image-preview').hidden = true;
      modal.querySelector('#modal-no-image').hidden = false;
    });

    // Save
    modal.querySelector('#modal-save').addEventListener('click', () => {
      const title = modal.querySelector('#modal-title').value.trim() || 'Untitled';
      const notes = modal.querySelector('#modal-notes').value;
      const sourceUrl = modal.querySelector('#modal-source-url').value.trim();
      const tags = getSelectedTagIds();
      const image = modal._pendingImage || '';

      const cardData = { title, notes, sourceUrl, tags, image };
      if (onSaveCallback) onSaveCallback(currentColId, currentCardId, cardData);
      close();
    });

    // Delete
    modal.querySelector('#modal-delete').addEventListener('click', () => {
      if (!currentCardId) return;
      if (confirm('Delete this card?')) {
        if (onDeleteCallback) onDeleteCallback(currentColId, currentCardId);
        close();
      }
    });

    // Cancel
    modal.querySelector('#modal-cancel').addEventListener('click', close);

    // Click backdrop
    modal.addEventListener('click', e => {
      if (e.target === modal) close();
    });
  }

  // Lightbox
  function openLightbox(src) {
    const lb = document.getElementById('lightbox');
    lb.querySelector('#lightbox-img').src = src;
    lb.hidden = false;
  }

  function closeLightbox() {
    const lb = document.getElementById('lightbox');
    lb.hidden = true;
    lb.querySelector('#lightbox-img').src = '';
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('lightbox').hidden) { closeLightbox(); return; }
      if (!document.getElementById('card-modal').hidden) { close(); return; }
    }
  });

  document.addEventListener('click', e => {
    if (e.target.id === 'lightbox' || e.target.id === 'lightbox-close') closeLightbox();
  });

  // Image compression
  function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 800;
        let w = img.width, h = img.height;
        if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const sizeKB = Math.round(dataUrl.length * 0.75 / 1024);
        if (sizeKB > 500) {
          showSizeWarning(sizeKB);
        }
        callback(dataUrl);
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  function showSizeWarning(sizeKB) {
    const w = document.getElementById('size-warning');
    w.textContent = `Image is ${sizeKB}KB after compression — may use significant storage.`;
    w.hidden = false;
    setTimeout(() => { w.hidden = true; }, 4000);
  }

  return { init, open, close, setImage, compressImage };
})();
