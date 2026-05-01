// Employee authorization via Firebase Authentication with admin approval.
(function () {
  'use strict';

  const USER_KEY = 'iskustv_current_user_v1';
  const ADMIN_MODE_KEY = 'iskustv_admin_mode_v1';
  let profileWatcher = null;

  function ensureFirebase() {
    if (!window.firebase || !window.firebase.auth) return false;
    try {
      if ((!window.firebase.apps || !window.firebase.apps.length) && window.ISKUSTV_FIREBASE_CONFIG) {
        window.firebase.initializeApp(window.ISKUSTV_FIREBASE_CONFIG);
      }
      return true;
    } catch (err) {
      console.warn('Firebase init in auth.js error:', err);
      return false;
    }
  }

  function getAuth() {
    if (!ensureFirebase()) return null;
    try { return window.firebase.auth(); }
    catch (_) { return null; }
  }

  function getDb() {
    if (!window.firebase || !window.firebase.database) return null;
    try { return window.firebase.database(); }
    catch (_) { return null; }
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw);
      if (!user || (!user.uid && !user.email && !user.firstName && !user.lastName)) return null;
      return user;
    } catch (_) { return null; }
  }

  function saveUser(user) {
    const clean = {
      uid: user.uid || '',
      email: String(user.email || '').trim().toLowerCase(),
      firstName: String(user.firstName || '').trim(),
      lastName: String(user.lastName || '').trim(),
      role: user.role || 'employee',
      approved: user.approved === true || user.status === 'approved',
      loggedAt: new Date().toISOString()
    };
    localStorage.setItem(USER_KEY, JSON.stringify(clean));
    localStorage.setItem(ADMIN_MODE_KEY, '0');
    return clean;
  }

  function clearUser() {
    localStorage.removeItem(USER_KEY);
    try {
      localStorage.removeItem('okk_review_state_v1');
      localStorage.removeItem('okk_review_notes_v1');
    } catch (_) {}
  }

  function notifyAccessBlocked() {
    window.dispatchEvent(new CustomEvent('iskustv:access-blocked'));
  }

  function fullName(user) {
    return [user && user.firstName, user && user.lastName].filter(Boolean).join(' ') || (user && user.email) || '';
  }

  function updateHeader(user) {
    const name = document.getElementById('crmUserName');
    const avatar = document.getElementById('crmUserAvatar');
    const text = fullName(user) || 'Сотрудник';
    if (name) name.textContent = text;
    if (avatar) avatar.textContent = (user && user.firstName ? user.firstName : text).trim().slice(0, 1).toUpperCase() || 'С';
  }

  function openAuth(user) {
    localStorage.setItem(ADMIN_MODE_KEY, '0');
    document.body.classList.add('auth-locked');
    const modal = document.getElementById('authModal');
    const email = document.getElementById('authEmail');
    const pass = document.getElementById('authPassword');
    const first = document.getElementById('authFirstName');
    const last = document.getElementById('authLastName');
    const error = document.getElementById('authError');
    if (modal) modal.setAttribute('aria-hidden', 'false');
    if (error) error.textContent = '';
    if (email) email.value = user && user.email ? user.email : '';
    if (pass) pass.value = '';
    if (first) first.value = user && user.firstName ? user.firstName : '';
    if (last) last.value = user && user.lastName ? user.lastName : '';
    setTimeout(function () { if (email) email.focus(); }, 30);
  }

  function closeAuth(user) {
    updateHeader(user);
    document.body.classList.remove('auth-locked');
    const modal = document.getElementById('authModal');
    if (modal) modal.setAttribute('aria-hidden', 'true');
    window.dispatchEvent(new CustomEvent('iskustv:user-changed', { detail: user }));
  }

  function keepAuthLocked(profile, message) {
    clearUser();
    updateHeader({ firstName: 'Ожидание', lastName: 'доступа', email: profile && profile.email });
    document.body.classList.add('auth-locked');
    const modal = document.getElementById('authModal');
    if (modal) modal.setAttribute('aria-hidden', 'false');
    showError(message || 'Заявка отправлена. Дождитесь подтверждения администратора.');
    notifyAccessBlocked();
  }

  function showError(message) {
    const error = document.getElementById('authError');
    if (error) error.textContent = message;
  }

  function authErrorMessage(err) {
    const code = err && err.code ? err.code : '';
    if (code === 'auth/email-already-in-use') return 'Этот email уже зарегистрирован. Нажмите «Войти сотрудником».';
    if (code === 'auth/invalid-email') return 'Некорректный email.';
    if (code === 'auth/weak-password') return 'Пароль должен быть минимум 6 символов.';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Неверный email или пароль.';
    if (code === 'auth/network-request-failed') return 'Нет соединения с Firebase. Проверьте интернет.';
    return 'Не удалось выполнить вход. Проверьте данные и попробуйте снова.';
  }

  function isApprovedProfile(profile) {
    return profile && (profile.approved === true || profile.status === 'approved');
  }

  function profileFromInputs(firebaseUser) {
    const first = document.getElementById('authFirstName');
    const last = document.getElementById('authLastName');
    return {
      uid: firebaseUser.uid,
      email: (firebaseUser.email || '').toLowerCase(),
      firstName: first ? first.value.trim() : '',
      lastName: last ? last.value.trim() : '',
      role: 'employee',
      approved: false,
      status: 'pending',
      updatedAt: new Date().toISOString()
    };
  }

  function stopProfileWatcher() {
    if (profileWatcher && profileWatcher.ref && profileWatcher.fn) {
      profileWatcher.ref.off('value', profileWatcher.fn);
    }
    profileWatcher = null;
  }

  function watchApproval(firebaseUser) {
    const db = getDb();
    if (!db || !firebaseUser) return;
    stopProfileWatcher();
    const ref = db.ref('okkReview/users/' + firebaseUser.uid);
    const fn = function (snapshot) {
      const profile = snapshot.val();
      if (!profile) {
        keepAuthLocked({ email: firebaseUser.email || '' }, 'Доступ удалён администратором. Обратитесь к администратору.');
        return;
      }
      if (isApprovedProfile(profile)) {
        closeAuth(saveUser(profile));
      } else if (profile.status === 'rejected') {
        keepAuthLocked(profile, 'Доступ отклонён администратором. Обратитесь к администратору.');
      } else if (profile.status === 'revoked') {
        keepAuthLocked(profile, 'Доступ забран администратором. Обратитесь к администратору.');
      } else {
        keepAuthLocked(profile, 'Заявка отправлена. Дождитесь, пока администратор нажмёт «Пустить».');
      }
    };
    ref.on('value', fn);
    profileWatcher = { ref: ref, fn: fn };
  }

  function loadEmployeeProfile(firebaseUser) {
    const db = getDb();
    if (!db || !firebaseUser) return Promise.resolve(null);
    return db.ref('okkReview/users/' + firebaseUser.uid).once('value').then(function (snapshot) {
      const data = snapshot.val();
      if (!data) {
        const display = String(firebaseUser.displayName || '').trim().split(/\s+/);
        const pending = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          firstName: display[0] || '',
          lastName: display.slice(1).join(' ') || '',
          role: 'employee',
          approved: false,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        return db.ref('okkReview/users/' + firebaseUser.uid).set(pending).then(function () { return pending; });
      }
      return data;
    });
  }

  function handleEmployeeProfile(firebaseUser) {
    return loadEmployeeProfile(firebaseUser).then(function (profile) {
      watchApproval(firebaseUser);
      if (isApprovedProfile(profile)) {
        closeAuth(saveUser(profile));
      } else {
        keepAuthLocked(profile, profile && profile.status === 'rejected'
          ? 'Доступ отклонён администратором. Обратитесь к администратору.'
          : profile && profile.status === 'revoked'
            ? 'Доступ забран администратором. Обратитесь к администратору.'
            : 'Заявка отправлена. Дождитесь, пока администратор нажмёт «Пустить».');
      }
    });
  }

  function registerEmployee() {
    const auth = getAuth();
    const db = getDb();
    const email = document.getElementById('authEmail');
    const pass = document.getElementById('authPassword');
    const first = document.getElementById('authFirstName');
    const last = document.getElementById('authLastName');
    if (!auth || !db || !email || !pass || !first || !last) { showError('Firebase Auth не подключён.'); return; }
    const firstName = first.value.trim();
    const lastName = last.value.trim();
    if (!firstName || !lastName) { showError('Для регистрации введите имя и фамилию.'); return; }
    localStorage.setItem(ADMIN_MODE_KEY, '0');
    auth.createUserWithEmailAndPassword(email.value.trim(), pass.value).then(function (cred) {
      const profile = profileFromInputs(cred.user);
      const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
      const updateProfile = cred.user.updateProfile ? cred.user.updateProfile({ displayName: displayName }) : Promise.resolve();
      const saveProfile = db.ref('okkReview/users/' + cred.user.uid).set(Object.assign({}, profile, { createdAt: new Date().toISOString() }));
      return Promise.all([updateProfile, saveProfile]).then(function () {
        watchApproval(cred.user);
        keepAuthLocked(profile, 'Заявка отправлена. Дождитесь, пока администратор нажмёт «Пустить».');
      });
    }).catch(function (err) { showError(authErrorMessage(err)); });
  }

  function loginEmployee() {
    const auth = getAuth();
    const email = document.getElementById('authEmail');
    const pass = document.getElementById('authPassword');
    if (!auth || !email || !pass) { showError('Firebase Auth не подключён.'); return; }
    localStorage.setItem(ADMIN_MODE_KEY, '0');
    auth.signInWithEmailAndPassword(email.value.trim(), pass.value).then(function (cred) {
      return handleEmployeeProfile(cred.user);
    }).catch(function (err) { showError(authErrorMessage(err)); });
  }

  function openAdminLogin() {
    stopProfileWatcher();
    const modal = document.getElementById('authModal');
    if (modal) modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('auth-locked');
    if (window.IskustvAdminAuth && window.IskustvAdminAuth.open) window.IskustvAdminAuth.open();
    else {
      const adminModal = document.getElementById('adminLockModal');
      if (adminModal) {
        adminModal.classList.add('is-open');
        adminModal.setAttribute('aria-hidden', 'false');
      }
    }
  }

  window.IskustvAuth = {
    getUser: getUser,
    fullName: fullName,
    openAuth: function () { openAuth(getUser()); },
    isEmployee: function () { return localStorage.getItem(ADMIN_MODE_KEY) !== '1'; }
  };

  document.addEventListener('DOMContentLoaded', function () {
    ensureFirebase();
    const cached = getUser();
    const auth = getAuth();

    if (auth) {
      auth.onAuthStateChanged(function (firebaseUser) {
        if (localStorage.getItem(ADMIN_MODE_KEY) === '1') {
          updateHeader({ firstName: 'Админ', lastName: '', email: firebaseUser && firebaseUser.email });
          document.body.classList.remove('auth-locked');
          return;
        }
        if (firebaseUser) {
          handleEmployeeProfile(firebaseUser).catch(function (err) { showError(authErrorMessage(err)); });
        } else {
          clearUser();
          openAuth(null);
        }
      });
    } else if (cached) closeAuth(cached);
    else openAuth(null);

    const changeBtn = document.getElementById('changeUserBtn');
    if (changeBtn) changeBtn.addEventListener('click', function () { openAuth(getUser()); });

    const form = document.getElementById('authForm');
    if (form) form.addEventListener('submit', function (event) {
      event.preventDefault();
      loginEmployee();
    });

    const regBtn = document.getElementById('employeeRegisterBtn');
    if (regBtn) regBtn.addEventListener('click', registerEmployee);

    const adminBtn = document.getElementById('openAdminLoginBtn');
    if (adminBtn) adminBtn.addEventListener('click', openAdminLogin);
  });
})();
