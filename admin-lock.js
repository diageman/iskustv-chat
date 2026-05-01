// Admin panel lock via Firebase Authentication.
(function () {
  'use strict';

  let adminUser = null;
  let authReady = false;

  function getAuth() {
    if (!window.firebase || !window.firebase.auth) return null;
    try { return window.firebase.auth(); }
    catch (_) { return null; }
  }

  function isUnlocked() {
    return !!adminUser;
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
    const email = document.getElementById('adminEmailInput');
    const password = document.getElementById('adminPasswordInput');
    const error = document.getElementById('adminLockError');
    if (!modal) return;
    if (error) error.textContent = '';
    if (password) password.value = '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(function () { if (email) email.focus(); }, 30);
  }

  function closeModal() {
    const modal = document.getElementById('adminLockModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function unlockAdmin(user) {
    adminUser = user || null;
    setAdminVisible(!!adminUser);
    if (adminUser) {
      closeModal();
      location.hash = 'admin';
      setTimeout(function () {
        const admin = document.getElementById('admin');
        if (admin) admin.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }

  function showAuthError(err) {
    const error = document.getElementById('adminLockError');
    const code = err && err.code ? err.code : '';
    let message = 'Не удалось войти. Проверьте email и пароль.';
    if (code === 'auth/invalid-email') message = 'Некорректный email.';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') message = 'Неверный email или пароль.';
    if (code === 'auth/too-many-requests') message = 'Слишком много попыток. Попробуйте позже.';
    if (code === 'auth/network-request-failed') message = 'Нет соединения с Firebase. Проверьте интернет.';
    if (error) error.textContent = message;
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.remove('admin-unlocked');
    setAdminVisible(false);

    const auth = getAuth();
    if (!auth) {
      console.warn('Firebase Auth не подключён. Админ-вход недоступен.');
      if (location.hash === '#admin') openModal();
    } else {
      try { auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL); } catch (_) {}
      auth.onAuthStateChanged(function (user) {
        authReady = true;
        adminUser = user || null;
        setAdminVisible(!!adminUser);
        if (adminUser) {
          closeModal();
          if (location.hash === '#admin') setTimeout(function () {
            const admin = document.getElementById('admin');
            if (admin) admin.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 60);
        } else if (location.hash === '#admin') {
          history.replaceState(null, '', location.pathname + location.search);
          openModal();
        }
      });
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
    const email = document.getElementById('adminEmailInput');
    const password = document.getElementById('adminPasswordInput');
    const error = document.getElementById('adminLockError');

    if (form && email && password) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (error) error.textContent = '';
        const authNow = getAuth();
        if (!authNow) {
          if (error) error.textContent = 'Firebase Auth не подключён. Проверьте настройки сайта.';
          return;
        }
        authNow.signInWithEmailAndPassword(email.value.trim(), password.value)
          .then(function (result) { unlockAdmin(result.user); })
          .catch(showAuthError);
      });
    }

    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        const authNow = getAuth();
        if (!authNow) return;
        authNow.signOut().then(function () {
          adminUser = null;
          setAdminVisible(false);
          closeModal();
          location.hash = 'workspace';
        }).catch(showAuthError);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeModal();
    });
  });
})();
