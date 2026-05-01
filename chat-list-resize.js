// Resizable employees/cases panel
(function () {
  'use strict';

  const WIDTH_KEY = 'iskustv_chat_list_width_v1';
  const MIN_WIDTH = 280;
  const MAX_WIDTH = 560;
  const DEFAULT_WIDTH = 430;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function setChatListWidth(width) {
    const next = clamp(Number(width) || DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH);
    document.documentElement.style.setProperty('--chat-list-width', next + 'px');
    localStorage.setItem(WIDTH_KEY, String(next));
  }

  document.addEventListener('DOMContentLoaded', function () {
    const panel = document.getElementById('crmChatListPanel');
    const resizer = document.getElementById('chatListResizer');
    if (!panel || !resizer) return;

    setChatListWidth(Number(localStorage.getItem(WIDTH_KEY)) || DEFAULT_WIDTH);

    let isDragging = false;

    function startDrag(event) {
      isDragging = true;
      document.body.classList.add('chat-list-resizing');
      event.preventDefault();
    }

    function moveDrag(event) {
      if (!isDragging) return;
      const rect = panel.getBoundingClientRect();
      const width = event.clientX - rect.left;
      setChatListWidth(width);
    }

    function stopDrag() {
      if (!isDragging) return;
      isDragging = false;
      document.body.classList.remove('chat-list-resizing');
    }

    resizer.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', stopDrag);
  });
})();
