/* ============================
 auth_popup.js (FULLY INTEGRATED)
  - Central orchestrator
  - Handles auth, session restore, role-based actions
  - Synchronizes Menu Toggle & Popup Filter
  - Manages global UI state (popupState)
- popupfilter.js : Filter UI logic only
- menu_toggle.js : Menu UI rendering
Single source of truth:
- popupState
- CURRENT_USER (session)
============================*/

$(document).ready(function() {
    console.log("auth_popup loaded ✅");

    // ---------------------------
    // Initialisation globale des boutons (“phares”)
    // ---------------------------
    const $signInBtn = $('#signInBtn');
    const $logoutBtn = $('#logoutBtn');
    $("#signInBtn").prop("disabled", false); // SignIn actif
    $("#menu-toggle, #filterBtn").prop("disabled", true); // menu & filter désactivés

    // ---------------------------
    // Global Variables
    // ---------------------------
    const $authModal = $('#authModal');
    const $loginTab = $authModal.find('.modal-tabs > #loginTab');
    const $registerTab = $authModal.find('.modal-tabs > #registerTab');
    const $loginFormContainer = $authModal.find('#loginFormContainer');
    const $registerFormContainer = $authModal.find('#registerFormContainer');
    const $loginForm = $authModal.find('#loginForm');
    const $registerForm = $authModal.find('#registerForm');

    // ============================
    // GLOBAL STATE
    // ============================
    var popupState = {
        role: null,
        activeMenu: null,
        activeFilter: null,
        menuOpen: false,
        filterOpen: false
    };

    // ---------------------------
    // Load user session automatically
    // ---------------------------
    loadSessionUser(enableDashboard);

    function loadSessionUser(callback) {
        $.ajax({
            url: "/dashboard/filter-session-data",
            method: "GET",
            dataType: "json",
            success: function(res) {
                if (!res.success || !res.results_preview.length) return;
                const u = res.results_preview[0];
                const user = { id: u.user_id, username: u.username, email: u.email, role: u.role.toLowerCase() };
                console.log("USER FROM SESSION:", user.id, user.role);
                window.CURRENT_USER = user; // single source of truth
                if (callback) callback(user);
            },
            error: function(err) { console.error("Session load error ⚠️", err); }
        });
    }

    // ---------------------------
    // Trigger Events
    // ---------------------------
    $signInBtn.on('click', function(e) { e.stopPropagation(); showAuthModal($(this)); });
    $(document).on('click', '.modal-close', closeAuthModal);
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#authModal, #signInBtn').length) closeAuthModal();
    });

    $loginTab.on('click', () => switchTab('login'));
    $registerTab.on('click', () => switchTab('register'));

    $loginForm.on('submit', async function(e) { e.preventDefault(); await handleLogin($(this)); });
    $registerForm.on('submit', async function(e) { e.preventDefault(); await handleRegister($(this)); });
    $logoutBtn.on('click', async function() { await handleLogout(); });

    // ---------------------------
    // Auth Modal Functions
    // ---------------------------
    function showAuthModal($button) {
        const offset = $button.offset();
        const btnHeight = $button.outerHeight();
        $authModal.css({ top: offset.top + btnHeight + 5 + "px", left: offset.left + "px", display: 'block' });
    }

    function closeAuthModal() { $authModal.hide(); }

    function switchTab(tab) {
        if (tab === 'login') {
            $loginFormContainer.show();
            $registerFormContainer.hide();
            $loginTab.addClass('active');
            $registerTab.removeClass('active');
            $registerFormContainer.find('.auth-message').hide();
        } else {
            $loginFormContainer.hide();
            $registerFormContainer.show();
            $loginTab.removeClass('active');
            $registerTab.addClass('active');
            $loginFormContainer.find('.auth-message').hide();
        }
    }

    // ---------------------------
    // Login / Register Handlers
    // ---------------------------
    async function handleLogin($form) {
        const $container = $form.closest('.form-container');
        const email = ($container.find('#loginEmail').val() || "").trim();
        const password = ($container.find('#loginPassword').val() || "").trim();
        const role = ($container.find('#loginRole').val() || "client").trim();

        if (!email || !password || !role) return showMessage($container, "All fields are required", "red");

        try {
            const loginUrl = role === "staff" ? "/staff/login" : "/user/login";
            const res = await $.ajax({
                url: loginUrl,
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({ email, password, role }),
                dataType: "json"
            });

            if (res.success) {
                showMessage($container, `Welcome, ${res.user.username}!`, "green");
                setTimeout(() => {
                    closeAuthModal();
                    enableDashboard(res.user, true); // true = login explicite pour popupfilter
                }, 1000);
            } else showMessage($container, res.message, "red");
        } catch (err) { showMessage($container, "Server error", "red"); console.error(err); }
    }

    async function handleRegister($form) {
        const $container = $form.closest('.form-container');
        const username = ($container.find('#registerUsername').val() || "").trim();
        const email = ($container.find('#registerEmail').val() || "").trim();
        const password = ($container.find('#registerPassword').val() || "").trim();
        const role = ($container.find('#registerRole').val() || "client").trim();

        if (!username || !email || !password || !role) return showMessage($container, "All fields are required", "red");

        const start_time = sessionStorage.getItem("registerStartTime") || new Date().toISOString();
        sessionStorage.setItem("registerStartTime", start_time);

        try {
            const registerUrl = role === "staff" ? "/staff/register" : "/user/register";
            const res = await $.ajax({
                url: registerUrl,
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({ username, email, password, role, start_time }),
                dataType: "json"
            });
            if (res.success) {
                showMessage($('#loginFormContainer'), res.message, "green");
                setTimeout(() => {
                    closeAuthModal();
                    switchTab('login');
                    $form[0].reset();
                    sessionStorage.removeItem("registerStartTime");
                }, 1000);
            } else showMessage($container, res.message, "red");
        } catch (err) { showMessage($container, "Server error", "red"); console.error(err); }
    }

    async function handleLogout() {
        try {
            const role = window.CURRENT_USER?.role || 'client';
            const logoutUrl = role === "staff" ? "/staff/logout" : "/user/logout";
            const resp = await $.ajax({ url: logoutUrl, method: "POST", dataType: "json" });
            if (resp.success) {
                $('.modal, .popup-container').hide();
                $('.modal .modal-body, .popup-container').empty();
                $logoutBtn.hide();
                $signInBtn.text("👤 Sign In").prop("disabled", false);
                $("#menu-toggle, #filterBtn").prop("disabled", true);
                popupState.menuOpen = false;
                popupState.filterOpen = false;
            }
        } catch (err) { console.warn(err); }
    }

    // ---------------------------
    // Dashboard / Popups
    // ---------------------------
    function enableDashboard(user, fromLogin = false) {
        if (!user?.role) return;
        window.CURRENT_USER = user;
        popupState.role = user.role;

        if (fromLogin) {
            // Login explicite : SignIn désactivé, menu + filter activés
            $("#signInBtn").prop("disabled", true);
            $("#menu-toggle, #filterBtn").prop("disabled", false);
            openPopupMenu();
            openPopupFilter();
        } else {
            // Restauration de session : SignIn actif, menu activé, filter fermé
            $("#signInBtn").prop("disabled", false);
            $("#menu-toggle, #filterBtn").prop("disabled", true);
            openPopupMenu();
        }
    }

    // ---------------------------
    // Popup Animations
    // ---------------------------
    window.openPopupMenu = function() {
        const $menu = $('#menuToggle');
        if ($menu.is(':visible')) $menu.stop(true,true).fadeOut(300).slideUp(300);
        else $menu.stop(true,true).fadeIn(300).slideDown(300);
    };

    window.openPopupFilter = function() {
        const $filter = $('#popupFilter');
        if ($filter.is(':visible')) $filter.stop(true,true).fadeOut(300).slideUp(300);
        else $filter.stop(true,true).fadeIn(300).slideDown(300);
    };

    // ---------------------------
    // Active Highlighting
    // ---------------------------
    function highlightActive(element, type) {
        if (type === 'menu') {
            $('#activeMenuItem').text(element);
            $('#menuToggle button').removeClass('active');
            $(`#menuToggle button:contains(${element})`).addClass('active');
        } else if (type === 'filter') {
            $('#activeFilter').text(element);
            $('#popupFilter button').removeClass('active');
            $(`#popupFilter button:contains(${element})`).addClass('active');
        }
    }

    window.onMenuItemClick = function(item) { highlightActive(item, 'menu'); console.log('Menu selected:', item); };
    window.onFilterChange = function(filter) { highlightActive(filter, 'filter'); console.log('Filter applied:', filter); };

    // ---------------------------
    // Helper: Show auth messages
    // ---------------------------
    function showMessage($container, msg, color) {
        $container.find('.auth-message').text(msg).css('color', color).show();
    }

    // ---------------------------
    // Animation helpers
    // ---------------------------
    function fadeIn(element, duration = 300) {
        element.style.opacity = 0;
        element.style.display = "block";
        let last = +new Date();
        const tick = function() {
            element.style.opacity = +element.style.opacity + (new Date() - last) / duration;
            last = +new Date();
            if (+element.style.opacity < 1) requestAnimationFrame(tick);
        };
        tick();
    }

    function fadeOut(element, duration = 300) {
        element.style.opacity = 1;
        let last = +new Date();
        const tick = function() {
            element.style.opacity = +element.style.opacity - (new Date() - last) / duration;
            last = +new Date();
            if (+element.style.opacity > 0) requestAnimationFrame(tick);
            else element.style.display = "none";
        };
        tick();
    }

    // ---------------------------
    // Initialize events
    // ---------------------------
    document.getElementById("popupCloseBtn")?.addEventListener("click", closePopup);

}); // document ready