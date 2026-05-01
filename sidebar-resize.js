// Resizable sidebar for Iskustv Chat
(function () {
  'use strict';

  const WIDTH_KEY = 'iskustv_sidebar_width_v1';
  const COLLAPSED_KEY = 'iskustv_sidebar_collapsed_v1';
  const MIN_WIDTH = 220;
  const MAX_WIDTH = 420;
  const COLLAPSED_WIDTH = 86;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function setWidth(width) {
    const next = clamp(Number(width) || 260, MIN_WIDTH, MAX_WIDTH);
    document.documentElement.style.setProperty('--sidebar-width', next + 'px');
    localStorage.setItem(WIDTH_KEY, String(next));
  }

  function setCollapsed(collapsed) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    document.documentElement.style.setProperty('--sidebar-width', collapsed ? COLLAPSED_WIDTH + 'px' : (localStorage.getItem(WIDTH_KEY) || '260') + 'px');

    const toggle = document.getElementById('sidebarToggle');
    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    if (toggle) toggle.textContent = collapsed ? '›' : '‹';
    if (collapseBtn) collapseBtn.textContent = collapsed ? '» Развернуть меню' : '« Свернуть меню';
  }

  document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.getElementById('crmSidebar');
    const resizer = document.getElementById('sidebarResizer');
    const toggle = document.getElementById('sidebarToggle');
    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    if (!sidebar || !resizer) return;

    const savedWidth = Number(localStorage.getItem(WIDTH_KEY)) || 260;
    const savedCollapsed = localStorage.getItem(COLLAPSED_KEY) === '1';
    setWidth(savedWidth);
    setCollapsed(savedCollapsed);

    let isDragging = false;

    function startDrag(event) {
      if (document.body.classList.contains('sidebar-collapsed')) setCollapsed(false);
      isDragging = true;
      document.body.classList.add('sidebar-resizing');
      event.preventDefault();
    }

    function moveDrag(event) {
      if (!isDragging) return;
      const width = clamp(event.clientX, MIN_WIDTH, MAX_WIDTH);
      setWidth(width);
    }

    function stopDrag() {
      if (!isDragging) return;
      isDragging = false;
      document.body.classList.remove('sidebar-resizing');
    }

    resizer.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', stopDrag);

    [toggle, collapseBtn].forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function () {
        setCollapsed(!document.body.classList.contains('sidebar-collapsed'));
      });
    });
  });
})();
