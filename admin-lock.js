// Admin panel PIN lock. The real PIN is not stored as plain text.
(function () {
  'use strict';

  const ADMIN_HASH = 'e430d621474f08cc8f71de6892e56f5db446b5b47498fe1ceb306a8a0a087b1f';
  const UNLOCK_KEY = 'iskustv_admin_unlocked_v1';

  function hexFromBuffer(buffer) {
    return Array.from(new Uint8Array(buffer)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  async function sha256(text) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('В этом браузере недоступна безопасная проверка кода. Откройте сайт в Chrome, Edge или Firefox.');
    }
    const data = new TextEncoder().encode(String(text));
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return hexFromBuffer(digest);
  }

  function isUnlocked() {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  }

  function setAdminVisible(visible) {
    const admin = document.getElementById('admin');
    if (!admin) return;
    admin.classList.toggle('is-admin-locked', !visible);
    document.body.classList.toggle('admin-unlocked', visible);
    admin.setAttribute('aria-hidden', visible ? 'false' : 'true');
    document.querySelectorAll('a[href="#admin"]').forEach(function (link) {
      link.classList.toggle('admin-locked-link', !visible);
    });
  }

  function openModal() {
    const modal = document.getElementById('adminLockModal');
    const input = document.getElementById('adminPinInput');
    const error = document.getElementById('adminLockError');
    if (!modal) return;
    if (error) error.textContent = '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(function () { if (input) { input.value = ''; input.focus(); } }, 30);
  }

  function closeModal() {
    const modal = document.getElementById('adminLockModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function unlockAdmin() {
    sessionStorage.setItem(UNLOCK_KEY, '1');
    setAdminVisible(true);
    closeModal();
    location.hash = 'admin';
    setTimeout(function () {
      const admin = document.getElementById('admin');
      if (admin) admin.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.remove('admin-unlocked');
    setAdminVisible(isUnlocked());

    if (location.hash === '#admin' && !isUnlocked()) {
      history.replaceState(null, '', location.pathname + location.search);
      openModal();
    }

    document.querySelectorAll('a[href="#admin"]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        if (isUnlocked()) return;
        event.preventDefault();
        openModal();
      });
    });

    document.querySelectorAll('[data-admin-lock-close]').forEach(function (item) {
      item.addEventListener('click', closeModal);
    });

    const form = document.getElementById('adminLockForm');
    const input = document.getElementById('adminPinInput');
    const error = document.getElementById('adminLockError');

    if (form && input) {
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (error) error.textContent = '';
        try {
          const hash = await sha256(input.value.trim());
          if (hash === ADMIN_HASH) {
            unlockAdmin();
          } else {
            if (error) error.textContent = 'Неверный пинкод.';
            input.value = '';
            input.focus();
          }
        } catch (err) {
          if (error) error.textContent = err.message || 'Не удалось проверить пинкод.';
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeModal();
    });
  });
})();
