// Employee name/surname authorization
(function () {
  'use strict';

  const USER_KEY = 'iskustv_current_user_v1';

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw);
      if (!user || !user.firstName || !user.lastName) return null;
      return user;
    } catch (_) { return null; }
  }

  function saveUser(firstName, lastName) {
    const user = {
      firstName: String(firstName || '').trim(),
      lastName: String(lastName || '').trim(),
      loggedAt: new Date().toISOString()
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  function fullName(user) {
    return [user && user.firstName, user && user.lastName].filter(Boolean).join(' ');
  }

  function updateHeader(user) {
    const name = document.getElementById('crmUserName');
    const avatar = document.getElementById('crmUserAvatar');
    const text = fullName(user) || 'Сотрудник';
    if (name) name.textContent = text;
    if (avatar) avatar.textContent = (user && user.firstName ? user.firstName : text).trim().slice(0, 1).toUpperCase() || 'С';
  }

  function openAuth(user) {
    document.body.classList.add('auth-locked');
    const modal = document.getElementById('authModal');
    const first = document.getElementById('authFirstName');
    const last = document.getElementById('authLastName');
    const error = document.getElementById('authError');
    if (modal) modal.setAttribute('aria-hidden', 'false');
    if (error) error.textContent = '';
    if (first) first.value = user && user.firstName ? user.firstName : '';
    if (last) last.value = user && user.lastName ? user.lastName : '';
    setTimeout(function () { if (first) first.focus(); }, 30);
  }

  function closeAuth(user) {
    updateHeader(user);
    document.body.classList.remove('auth-locked');
    const modal = document.getElementById('authModal');
    if (modal) modal.setAttribute('aria-hidden', 'true');
    window.dispatchEvent(new CustomEvent('iskustv:user-changed', { detail: user }));
  }

  window.IskustvAuth = { getUser: getUser, fullName: fullName, openAuth: function () { openAuth(getUser()); } };

  document.addEventListener('DOMContentLoaded', function () {
    const user = getUser();
    if (user) closeAuth(user);
    else openAuth(null);

    const changeBtn = document.getElementById('changeUserBtn');
    if (changeBtn) changeBtn.addEventListener('click', function () { openAuth(getUser()); });

    const form = document.getElementById('authForm');
    const first = document.getElementById('authFirstName');
    const last = document.getElementById('authLastName');
    const error = document.getElementById('authError');
    if (!form || !first || !last) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const firstName = first.value.trim();
      const lastName = last.value.trim();
      if (!firstName || !lastName) {
        if (error) error.textContent = 'Введите имя и фамилию.';
        return;
      }
      closeAuth(saveUser(firstName, lastName));
    });
  });
})();
