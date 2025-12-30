$(document).ready(function () {
    const $menuToggle = $("#menu-toggle");
    const $menuPanel  = $("#menu-menuContent");

    $menuPanel.hide();
    $menuToggle.prop("disabled", true);

    function openMenu() {
        const currentUser = User.getCurrentUser(); // utiliser l'objet global
        if (!currentUser) {
            console.warn("No user session, menu-toggle disabled");
            return;
        }

        $menuPanel.empty().append(`
            <div class="menu-header">
                <span>Welcome 🤗 ${currentUser.username}</span>
                <button id="menuExitBtn">✖ Exit</button>
            </div>
            <input type="hidden" id="menu-id" value="${currentUser.id}">
            <input type="hidden" id="menu-role" value="${currentUser.role}">
            <input type="hidden" id="menu-email" value="${currentUser.email}">
        `);

        $("#menuExitBtn").on("click", e => {
            e.stopPropagation();
            $menuPanel.hide();
        });

        populateMenu(currentUser.role);
        $menuToggle.prop("disabled", false);
        $menuPanel.fadeIn(150);
    }

    $menuToggle.on("click", e => {
        e.stopPropagation();
        openMenu();
    });

    $(document).on("click", e => {
        if (!$(e.target).closest("#menu-menuContent, #menu-toggle").length) {
            $menuPanel.hide();
        }
    });

    function populateMenu(userRole) {
        const $menu = $("<ul/>", { class: "menu" });
        ["admin","client","staff","all"].forEach(sectionKey => {
            const section = MENU_DEFINITION[sectionKey];
            if(!section) return;
            const $li = $("<li/>", { class: "menu-section" });
            const $title = $("<div/>", { class: "menu-title", text: section.label });
            const $submenu = $("<ul/>", { class: "submenu", style: "display:none" });

            section.items.forEach(item => {
                if(sectionKey !== "all" && sectionKey !== userRole) return;
                const $item = $("<li/>", {
                    class: "submenu-item",
                    text: item.label,
                    "data-template": item.template,
                    "data-zone": item.zone
                });

                $item.on("click", function() {
                    if(item.label === "Exit") {
                        $menuPanel.hide();
                        return;
                    }

                    $(this).closest(".submenu").find("li").removeClass("active-item");
                    $(this).addClass("active-item");
                      // Vider zone4 sauf zone4-data
                    $("#zone4").children().not("#zone4-data").remove();


                    const zone = $(this).data("zone") || "zone4-data";
                    const template = $(this).data("template");

                    if(!$("#" + zone).length) {
                        console.error(zone + " not found");
                        return;
                    }
                  
                    // Toujours afficher la zone
                    $("#" + zone).show().empty().load(template, (response, status, xhr) => {
                        if(status === "error"){
                            $("#" + zone).html(`<p style="color:red;">⚠️ Impossible de charger ${template}</p>`);
                            console.error("Erreur chargement:", xhr.status, xhr.statusText);
                        }
                    });
                });

                $submenu.append($item);
            });

            $title.on("click", () => $submenu.slideToggle(150));
            $li.append($title, $submenu);
            $menu.append($li);
        });

        $menuPanel.append($menu);
    }
});