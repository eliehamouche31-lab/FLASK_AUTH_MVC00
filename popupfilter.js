// ==========================
// popupfilter.js
// ==========================
$(document).ready(function () {
    window.INVOICE_MODE = false;
    $("#filterBtn").prop("disabled", true);
    let currentUser = null;

    // ==========================
    // Définition des entités et labels
    // ==========================
    const entitiesByRole = {
        client: ["users","services","service_options","option_detail","type_service_option","payment","invoice"],
        staff: ["users","service_options","type_service_option","payment2","invoice2"],
        admin: ["users","services","service_options","option_detail","type_service_option","payment","invoice","staff","payment2","invoice2"]
    };

    const entityLabels = {
        users: "Users",
        services: "Services",
        service_options: "Service Options",
        option_detail: "Option Details",
        type_service_option: "Type Service Option",
        payment: "Payment",
        invoice: "Invoice Client",
        staff: "Staff",
        payment2: "Payment Staff",
        invoice2: "Invoice Staff"
    };

    // ==========================
    // Charger session depuis serveur
    // ==========================
    function loadSessionFromServer(callback) {
        $.ajax({
            url: "/dashboard/filter-session-data",
            method: "GET",
            dataType: "json",
            success: function(res) {
                if (!res.success || !res.results_preview.length) return;

                const userData = res.results_preview[0];

                // Créer instance User
                currentUser = new User({
                    id: userData.user_id,
                    username: userData.username,
                    email: userData.email,
                    role: userData.role.toLowerCase(),
                    entity: "users" // valeur par défaut
                });

                // Stocker globalement
                User.setCurrentUser(currentUser);

                // Remplir champs hidden / affichage
                $("#welcome-role").val(currentUser.role);
                $("#welcome-id").val(currentUser.id);
                $("#welcome-username").val(currentUser.username);
                $("#welcome-email").val(currentUser.email);

                if (callback) callback(currentUser);
            },
            error: function(err) {
                console.error("Erreur AJAX session:", err);
            }
        });
    }

    // ==========================
    // Ouvrir le popup filter
    // ==========================
    window.openPopupFilter = function() {
        $("#popup-filter-panel, #popup-welcome").addClass("active");

        loadSessionFromServer(function(user) {
            populateDropdown(user.role);
        });
    };

    // ==========================
    // Populate dropdown selon rôle
    // ==========================
    function populateDropdown(role) {
        const dropdown = $("#filter-entity");
        dropdown.empty();

        // Récupérer entités autorisées selon rôle
        const allowed = entitiesByRole[role] || entitiesByRole.client;

        allowed.forEach(entity => {
            dropdown.append(`<option value="${entity}">${entityLabels[entity]}</option>`);
        });

        dropdown.prop("disabled", allowed.length === 0);
    }

// ==========================
// Central dispatcher: action on entity change
// ==========================
$("#filter-entity").off("change").on("change", function () {

    const entity = $(this).val()?.trim();
    if (!entity) return;

    const currentUser = User.getCurrentUser();
    if (!currentUser) {
        console.warn("No current user found");
        return;
    }

    // persist selected entity
    currentUser.entity = entity;
    User.setCurrentUser(currentUser);

    const role = currentUser.role; // "customer", "admin", "staff"

    console.log("Entity changed:", { role, entity });

       // Détermine si c'est un popup invoice
    const isInvoicePopup =
        (role === "client" && entity === "invoice") ||
        (role === "admin" && (entity === "invoice" || entity === "invoice2")) ||
        (role === "staff" && entity === "invoice2");

    // Cache toutes les zones au départ
    $("#zone4").children().hide();

    if (isInvoicePopup) {
        // Montre la zone invoice et lance le popup
        $("#zone4-invoice").show();
        window.openInvoicePopup(currentUser, entity);
    } else {
        // Montre la zone magic table et charge les données
        $("#zone4-data").show();
        f_magictable(currentUser, entity);
    }
});


//---------------- magictable fucntion ------------------------
function f_magictable(user, entity) {
    const container = $("#zone4-data"); // minuscules
    if (!container.length) {
        console.error("zone4-data not found!");
        return;
    }

    container.empty().append("<p>Loading data...</p>");

    $.ajax({
        url: `/magic_table_data`,
        method: "GET",
        data: { username: user.username, entity },
        dataType: "json"
    }).done(function(resp) {
        container.empty();

        if (!resp.data || !resp.data.length) {
            container.html("<p>No data available</p>");
            return;
        }

        // Génère un tableau dynamique
        let table = `<table class="table table-sm"><thead><tr>`;
        Object.keys(resp.data[0]).forEach(k => table += `<th>${k}</th>`);
        table += `</tr></thead><tbody>`;

        resp.data.forEach(row => {
            table += "<tr>";
            Object.values(row).forEach(val => table += `<td>${val}</td>`);
            table += "</tr>";
        });
        table += "</tbody></table>"; // <-- backtick enlevé

        container.html(table);
    }).fail(function(err) {
        console.error("Error loading magic table:", err);
        container.html("<p class='text-danger'>Error loading data</p>");
    });
}

 
    // ==========================
    // Fermer popup
    // ==========================
    $(document).on("click", "#popup-filter-close", () => {
        $("#form, #zone4").empty();
        $("#popup-filter-panel, #popup-welcome").removeClass("active");
    });
});