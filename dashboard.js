 // ============================
// dashboard.js (Final Unified & Optimized with IED + Filter)
// ============================
 
$(document).ready(function() {
    console.log("dashboard.js loaded ✅");
    
    // Kill anonymous overlay / shadow
    $("#shadow").hide();

    // ------------------ Variables ------------------
    const $signinBtn = $('#signInBtn');
    const $searchBtn = $('#searchBtn');
    const $searchInput = $('#search-input');
    const $zone3 = $('#zone3');
    const $menuToggle = $('.menu-toggle');
    const $menuContent = $('#menuContent');
    const $menuCloseBtn = $('#menuCloseBtn');
    let menuOpen = false;

    const $tm1Section = $("#tm1-section");
    const $tm2Section = $("#tm2-section");
    const $zone4 = $("#zone4");
    const $zone4Data = $("#zone4-data");
    const $welcomeMsg = $("#welcome-msg");

    // ⚡ Déclaration des variables globales
    window.CURRENT_USER_ID = "{{ session.get('user_id', 'null') }}";
    window.CURRENT_USER_ROLE = "{{ session.get('role', '') }}";

    if (!window.CURRENT_USER_ID) console.warn("⚠️ CURRENT_USER_ID is missing");
    if (!window.CURRENT_USER_ROLE) console.warn("⚠️ CURRENT_USER_ROLE not defined");

    let currentTM1Id = null;

   $(document).ready(function () {
    $("#zone4-data").empty();
  });
 
 
    
    // ------------------ Sign-in & Menu ------------------
    $signinBtn.on('click', function(e) {     
        e.stopPropagation();
        const offset = $signinBtn.offset();
        const btnHeight = $signinBtn.outerHeight();
        $('#authModal').css({
            top: offset.top + btnHeight + 5 + "px",
            left: offset.left + "px",
            position: 'absolute',
            zIndex: 9999,
            display: 'block'
        });
    });

// trigger accordion ------------------

    $menuToggle.on('click', function(e) {
        e.stopPropagation();
        $menuContent.toggle();
        menuOpen = !menuOpen;
    });

    // Click outside menu closes it
    $(document).on('click', function() {
        if (menuOpen) {
            $menuContent.slideUp(200);
            menuOpen = false;
        }
    });

    $menuContent.on('click', function(e) {
        e.stopPropagation();
    });

    $menuCloseBtn.on('click', function() {
        $menuContent.hide();
        menuOpen = false;
    });

    // Auth modal click outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#authModal, #signInBtn').length) $('#authModal').hide();
        if (!$(e.target).closest('#menuContent, .menu-toggle').length && menuOpen) {
            $menuContent.hide();
            menuOpen = false;
        }
    });
 


 // ------------------- TRIGGER USER PROFILE -------------------
 $(document).on('click', '#menu-toggle', function (e) {
    e.preventDefault();   // optionnel (évite les jumps)
    // ton code ici :
    console.log('Menu toggle clicked!');
});

// ------------------ Load Zone3 / Accordion ------------------
    async function loadZone3() {
        try {
            const res = await fetch('/dashboard/api/zone3/services_options');
            const services = await res.json();
            const $zone3Content = $('#zone3 .inner-text');
            $zone3Content.empty();

            services.forEach(service => {
                const $serviceBlock = $('<div/>', { class: 'service-block' });
                const $header = $('<div/>', { class: 'service-header', role: 'button', tabindex:0 })
                    .append(`<img src="/static/${service.icon_path}" alt="${service.name}" style="width:40px;height:40px;margin-right:8px;">`)
                    .append($('<span/>', { text: service.name }));

                const $options = $('<ul/>', { class: 'service-options' });
                (service.options || []).forEach(opt => {
                    $options.append($('<li/>').append($('<a/>', { href:'#', class:'zone3-link', 'data-option-id': opt.id, text: opt.name })));
                });

                $header.on('click keypress', e => {
                    if (e.type==='keypress' && e.key!=='Enter' && e.key!==' ') return;
                    $('.service-options').not($options).slideUp(120);
                    $options.slideToggle(120);
                });

                $serviceBlock.append($header).append($options);
                $zone3Content.append($serviceBlock);
            });
        } catch(err) {
            console.error('loadZone3 error:', err);
            $('#zone3 .inner-text').html('<p>⚠️ Impossible de charger les services.</p>');
        }
    }

    loadZone3();

    // ------------------ Zone3 Click Trigger ------------------
    $(document).on("click", ".zone3-link", function(e) {
      //  e.preventDefault();
        $("#welcome-msg, #footer").remove(); // Supprime logo+text+footer
        const serviceId = $(this).data("option-id");
        if (!serviceId || !CURRENT_USER_ID) return console.warn("Missing serviceId or CURRENT_USER_ID");
      //  $("#zone4").empty();
        loadTM1(serviceId, CURRENT_USER_ID);
    });

    // ------------------ Load TM1 ------------------
    function loadTM1(serviceId, userId) {
        $.ajax({
            url: "/dashboard/getTM1",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ service_id: serviceId, user_id: userId }),
            success: function(resp) {
                if (resp.success && resp.tm1) renderTM1(resp.tm1);
                else $("#zone4").html("<p>No TM1 data available.</p>");
            },
            error: function(err) {
                console.error("TM1 AJAX error:", err);
                $("#zone4").html("<p>Error loading TM1.</p>");
            }
        });
    }

    // ------------------ Render TM1 ------------------
function renderTM1(data) {
    $tm1Section.empty();
    $zone4.addClass("tm1-active");
    $welcomeMsg.hide();

    if (!data || !data.length) return $tm1Section.html("<p>No TM1 options found.</p>");

    const table = $("<table>").addClass("table table-striped table-bordered tm1-table");
    const thead = $("<thead>");
    const headerRow = $("<tr>");
    ["Service ID", "Option Name", "Image", "Checked", "Link", "Detail"].forEach(col => 
        headerRow.append($("<th>").text(col))
    );
    thead.append(headerRow);
    table.append(thead);

    const tbody = $("<tbody>");
    data.forEach(item => {
        const row = $("<tr>").addClass("tm1-row").data("record", item);

        // Hidden ID
        row.append($("<td>").text(item.service_option_id).css("display", "none"));
        // Visible fields
        row.append($("<td>").text(item.service_id));
        row.append($("<td>").text(item.option_name));
        row.append($("<td>").html(item.image ? `<img src="${item.image}" width="50">` : ""));
        row.append($("<td>").text(item.checked_option ? "✔" : "x"));
        row.append($("<td>").html(item.link));

        // Detail button
        const detailTd = $("<td>");
        const detailBtn = $("<button>").addClass("btn btn-info btn-sm tm1-detail-btn").text("Detail");
        detailTd.append(detailBtn);
        row.append(detailTd);

        tbody.append(row);
    });
    table.append(tbody);
    $tm1Section.append(table);
}

// ------------------ TM1 Detail Trigger → Load TM2 ------------------
$(document).on("click", ".tm1-detail-btn", function() {
    const record = $(this).closest("tr").data("record");
    if (!record) return;

    currentTM1Id = record.service_option_id;
    loadTM2(currentTM1Id);
});

function loadTM2(tm1Id) {
    if (!tm1Id) return;
    $.ajax({
        url: "/dashboard/getTM2",
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({ service_option_id: tm1Id }),
        success: function(resp) {
            if (resp.success && resp.tm2) {
                renderTM2(resp.tm2);
            } else {
                $("#tm2-section").html("<p>No TM2 records found.</p>");
            }
        },
        error: function(err) {
            console.error("TM2 AJAX error:", err);
            $("#tm2-section").html("<p>❌ Failed to load TM2 records.</p>");
        }
    });
}

// ------------------ Render TM2 avec ligne Total ------------------
function renderTM2(data) {
    const $zone4 = $("#zone4");
    const $zone4Data = $("#tm2-section");
    const $zone3 = $("#zone3");

    // Safety checks
    if ($zone4Data.length === 0 || $zone3.length === 0) {
        console.warn("Missing #zone4-data or #zone3 in DOM.");
    }

    $zone4Data.stop(true, true).empty().show();

    if (!data || !data.length) {
        $zone4Data.html("<p>No TM2 records found for this TM1.</p>");
        return;
    }

    const table = $("<table>").addClass("table table-bordered table-striped tm2-table align-middle");
    const thead = $("<thead>");
    const headerRow = $("<tr>");
    ["Description", "Status", "Subscription Value", "Payment Type", "Amount", "Tax", "Invoice Nb", "Actions"]
        .forEach(col => headerRow.append($("<th>").text(col)));
    thead.append(headerRow);
    table.append(thead);

    const tbody = $("<tbody>");
    let totalSubscriptionValue = 0;
    let totalAmount = 0;

    // --- Render rows ---
    data.forEach(item => {
        const row = $("<tr>").data("record", item);
        row.append($("<td>").text(item.option_detail_id || "").css("display", "none"));
        row.append($("<td>").text(item.description || ""));
        row.append($("<td>").text(item.subscription_status || ""));
        row.append($("<td>").text(item.subscription_value != null ? item.subscription_value : ""));
        row.append($("<td>").text(item.payment_type || ""));
        row.append($("<td>").text(item.amount != null ? item.amount : ""));
        row.append($("<td>").text(item.tax_rate || ""));
        row.append($("<td>").text(item.InvoiceNb_id || ""));

        totalSubscriptionValue += Number(parseFloat(item.subscription_value) || 0);
        totalAmount += Number(parseFloat(item.amount) || 0);

        tbody.append(row);
    });

    // --- Build sticky TOTAL row ---
    const totalRow = $("<tr>").addClass("tm2-total-row fw-bold").css({
        "background-color": "#3868ebff", // blue sky
        "color": "white",
        "position": "sticky",
        "bottom": "0",
        "z-index": "10"
    });

    totalRow.append($("<td>").text("TOTAL"));
    totalRow.append($("<td>").text(""));

    const subInput = $("<input>").attr({ type: "text", readonly: true }).addClass("form-control form-control-sm")
        .val(totalSubscriptionValue.toFixed(2));
    totalRow.append($("<td>").append(subInput));

    totalRow.append($("<td>").text(""));

    const amtInput = $("<input>").attr({ type: "text", readonly: true }).addClass("form-control form-control-sm")
        .val(totalAmount.toFixed(2));
    totalRow.append($("<td>").append(amtInput));

    totalRow.append($("<td>").text(""));
    totalRow.append($("<td>").text(""));

    const cancelTd = $("<td>");
    const cancelBtn = $("<button>").addClass("btn btn-secondary btn-sm").attr("type", "button").text("Cancel")
        .on("click", function () {
            console.log("TM2 Cancel clicked: hiding zone4-data and returning to zone3.");
            $zone4Data.fadeOut(250, function () {
                $zone4Data.empty().hide();
                $zone3.fadeIn(200, function () {
                    $zone3[0].scrollIntoView({ behavior: "smooth", block: "start" });
                });
                if (typeof restoreFooter === "function") restoreFooter();
            });
        });
    cancelTd.append(cancelBtn);
    totalRow.append(cancelTd);

    tbody.append(totalRow);
    table.append(tbody);

    $zone4Data.append("<h5>TM2 Records</h5>", table);

    // Ensure totals cannot be focused/edited
    subInput.prop("readonly", true).attr("tabindex", "-1");
    amtInput.prop("readonly", true).attr("tabindex", "-1");

    // --- Animate TOTAL row (green) ---
    animateTotalGlow(totalRow);
}

// --- Green glow animation function ---
function animateTotalGlow($row) {
    $row.addClass("gray");
    setTimeout(() => $row.removeClass("gray"), 500); // 0.5s glow
}
 


//----------------empty zone4 ---------------------
function emptyZone4() {
    const $zone = $("#zone4");
    $zone.children().remove();  // supprime tout contenu
   
}

//----------------restore zone4 ---------------------
function restoreFooter() {
    $("#footer").show();
}
 
 

// -----------------trigger TM1 --------------------------
$(document).on("click", ".tm1-ied-btn, .tm2-ied-btn", function() {
    const $row = $(this).closest("tr");
    const record = $row.data("record");
    if (!record) return;

    // Supprime tout formulaire inline déjà ouvert
    $(".edit-row").remove();

    // Création du formulaire inline
    const $editRow = $(`
        <tr class="edit-row">
            <td><input type="text" name="description" value="${record.description}"></td>
            <td>
                <button class="save-btn">Save</button>
                <button class="cancel-btn">Cancel</button>
                <button class="delete-btn">Delete</button>
            </td>
        </tr>
    `);

    // Insère juste après la ligne cliquée
    $row.after($editRow);
});

// -----------------trigger TM2 --------------------------
$(document).on("click", ".tm2-ied-btn", function() {
    const record = $(this).closest("tr").data("record");
    if (!record) return;

    console.log("Trigger TM2 sélectionné :", record.option_detail_id, record.description, record.subscription_status);

     $("#zone4").children().remove(); // supprime tout ancien contenu

    // Afficher le popup TM2
    $("#IED_tm2_container").show();

    console.log("TM2 Trigger sélectionné :", record.option_detail_id, record.description, record.subscription_status);
});
 
 
 // -----------------Trigger filter -----------------------

$("#filterBtn").off("click").on("click", function() {
    // Appelle la fonction exposée par popupfilter.js
    if (typeof window.openPopupFilter === "function") {
        window.openPopupFilter();
    }
});
 


//--------------------------------------------------------------------------------------------
$(document).on("click", ".insert-btn, .update-btn, .delete-btn", function() {
    const $row = $(this).closest("tr");
    const record = $row.data("record") || {}; // vide si Insert

    // Supprime tout formulaire inline déjà ouvert
    $(".edit-row").remove();

    // Déterminer le type d'opération
    const isInsert = $(this).hasClass("insert-btn");
    const isUpdate = $(this).hasClass("update-btn");
    const isDelete = $(this).hasClass("delete-btn");

    if (isDelete) {
        // Delete directement via AJAX
        const recordId = record.option_detail_id || record.service_option_id;
        $.post("/deleteRecord", { id: recordId }, function() {
            $row.remove();
        }).fail(() => alert("Erreur lors de la suppression."));
        return;
    }

    // Formulaire inline pour Insert ou Update
    const $editRow = $(`
        <tr class="edit-row">
            <td colspan="${$row.children().length}">
                <input type="text" class="form-control form-control-sm edit-description" value="${record.description || ''}" placeholder="Description">
                <button class="btn btn-success btn-sm save-btn">Save</button>
                <button class="btn btn-secondary btn-sm cancel-btn">Cancel</button>
            </td>
        </tr>
    `);
    $row.after($editRow);

});


$(document).ready(function() {
    // Function to load a tab
    function loadTab(url, zone) {
        $.get(url, function(data) {
            $("#" + zone).html(data);
        }).fail(function() {
            alert("Failed to load tab. Please check the URL or server.");
        });
    }

    // Bind clicks for dynamic menu items
    Object.values(window.MENU_DEFINITION).forEach(section => {
        section.items.forEach(item => {
            // Assuming menu buttons have IDs like 'menu-<label>'
            $("#menu-" + item.label.replace(/\s+/g, '-')).on('click', function(e) {
                e.preventDefault();
                loadTab(item.template, item.zone);
            });
        });
    });
});

 

// ------------------------------------------- Helpers --------------------------------------------
function removeEditRows() {
    $(".tm1-edit-row").remove();
}

// Crée l'HTML du formulaire inline pour TM1
function createTM1EditRow(record = {}, mode = "update") {
    // mode: "update" | "insert"
    const readonlyId = record.service_option_id ? record.service_option_id : "";
    const optionName = record.option_name ? record.option_name : "";
    const link = record.link ? record.link : "";
    const checked = record.checked_option ? (record.checked_option ? "checked" : "") : "";
    const imagePreview = record.image ? `<img src="${record.image}" class="tm1-image-preview" width="60">` : "";

    const colspan = $(".tm1-table thead tr th").length; // adjust to table columns count

    const $edit = $(`
        <tr class="tm1-edit-row">
            <td colspan="${colspan}">
                <div class="tm1-edit-form" style="display:flex;gap:8px;align-items:center;">
                    <div>
                        <label>Service ID (readonly)</label><br>
                        <input type="text" name="service_option_id" class="form-control form-control-sm tm1-service-id" value="${readonlyId}" readonly>
                    </div>

                    <div>
                        <label>Option Name</label><br>
                        <input type="text" name="option_name" class="form-control form-control-sm tm1-option-name" value="${optionName}">
                    </div>

                    <div>
                        <label>Image</label><br>
                        ${imagePreview}
                        <input type="file" accept="image/*" name="image_file" class="form-control form-control-sm tm1-image-file">
                    </div>

                    <div>
                        <label>Checked</label><br>
                        <input type="checkbox" name="checked_option" class="tm1-checked" ${checked}>
                    </div>

                    <div>
                        <label>Link</label><br>
                        <input type="url" name="link" class="form-control form-control-sm tm1-link" value="${link}">
                    </div>

                    <div style="display:flex;flex-direction:column;gap:6px;margin-left:8px;">
                        <button class="btn btn-success btn-sm tm1-save-btn">${mode === "insert" ? "Insert" : "Save"}</button>
                        <button class="btn btn-secondary btn-sm tm1-cancel-btn">Cancel</button>
                        ${mode === "update" ? '<button class="btn btn-danger btn-sm tm1-delete-btn">Delete</button>' : ''}
                    </div>
                </div>
            </td>
        </tr>
    `);

    return $edit;
}

// Preview image when chosen
$(document).on("change", ".tm1-image-file", function() {
    const file = this.files && this.files[0];
    const $container = $(this).closest(".tm1-edit-form");
    if (!file) {
        $container.find(".tm1-image-preview").remove();
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        // remove old preview then append new
        $container.find(".tm1-image-preview").remove();
        $container.prepend(`<img src="${e.target.result}" class="tm1-image-preview" width="60">`);
    };
    reader.readAsDataURL(file);
});


// ---------- Triggers: Insert / Update / Delete buttons ----------
$(document).on("click", ".tm1-table .insert-btn, .tm1-table .update-btn, .tm1-table .delete-btn", function(e) {
    e.preventDefault();
    const $btn = $(this);
    const $row = $btn.closest("tr");
    const record = $row.data("record") || {};

    removeEditRows();

    if ($btn.hasClass("delete-btn")) {
        // Confirm then call delete endpoint
        const id = record.service_option_id;
        if (!id) return alert("Impossible de supprimer : ID manquant.");
        if (!confirm("Confirmer la suppression ?")) return;
        $.post("/deleteTM1", { id: id })
            .done(function() { $row.remove(); })
            .fail(function() { alert("Erreur lors de la suppression."); });
        return;
    }

    // Insert or Update: show inline form after the row
    const mode = $btn.hasClass("insert-btn") ? "insert" : "update";
    const $editRow = createTM1EditRow(mode === "update" ? record : {}, mode);
    $row.after($editRow);
});

// ---------- Save (Insert / Update) ----------
$(document).on("click", ".tm1-save-btn", function(e) {
    e.preventDefault();
    const $btn = $(this);
    const $editRow = $btn.closest("tr");
    const $form = $editRow.find(".tm1-edit-form");
    // Identify the original row (may be previous sibling)
    const $originalRow = $editRow.prev();
    const originalRecord = $originalRow.data("record") || {};

    const service_option_id = $form.find(".tm1-service-id").val();
    const option_name = $form.find(".tm1-option-name").val();
    const link = $form.find(".tm1-link").val();
    const checked_val = $form.find(".tm1-checked").is(":checked") ? 1 : 0;
    const fileInput = $form.find(".tm1-image-file")[0];
    const file = fileInput && fileInput.files && fileInput.files[0];

    // Build FormData for file support
    const fd = new FormData();
    fd.append("service_option_id", service_option_id);
    fd.append("option_name", option_name);
    fd.append("link", link);
    fd.append("checked_option", checked_val);

    if (file) fd.append("image_file", file);

    // Determine endpoint (insert vs update)
    const isInsert = !service_option_id || service_option_id === "";
    const url = isInsert ? "/insertTM1" : "/updateTM1";

    $.ajax({
        url: url,
        method: "POST",
        data: fd,
        processData: false,
        contentType: false
    }).done(function(res) {
        // res should contain the saved record (with IDs and image URL if any)
        // Update UI: if insert, add new row after originalRow; if update, update originalRow
        const saved = res || {};

        if (isInsert) {
            // create a new table row consistent with renderTM1
            const $newRow = $(`
                <tr class="tm1-row"></tr>
            `);
            $newRow.data("record", saved);
            $newRow.append($("<td>").text(saved.service_option_id || "").css("display", "none"));
            $newRow.append($("<td>").text(saved.service_id || ""));
            $newRow.append($("<td>").text(saved.option_name || ""));
            $newRow.append($("<td>").html(saved.image ? `<img src="${saved.image}" width="50">` : ""));
            $newRow.append($("<td>").text(saved.checked_option ? "✔" : "x"));
            $newRow.append($("<td>").html(saved.link || ""));
            const actionTd = $("<td>");
            actionTd.append(
                $('<button class="btn btn-success btn-sm me-1 insert-btn">Insert</button>'),
                $('<button class="btn btn-warning btn-sm me-1 update-btn">Update</button>'),
                $('<button class="btn btn-danger btn-sm delete-btn">Delete</button>')
            );
            $newRow.append(actionTd);
            $originalRow.after($newRow);
        } else {
            // Update existing row cells (assumes same column order as renderTM1)
            $originalRow.data("record", saved);
            const $cells = $originalRow.children("td");
            // hidden id (index 0)
            $cells.eq(0).text(saved.service_option_id || "");
            $cells.eq(1).text(saved.service_id || "");
            $cells.eq(2).text(saved.option_name || "");
            $cells.eq(3).html(saved.image ? `<img src="${saved.image}" width="50">` : "");
            $cells.eq(4).text(saved.checked_option ? "✔" : "x");
            $cells.eq(5).html(saved.link || "");
        }

        removeEditRows();
    }).fail(function() {
        alert("Erreur lors de l'enregistrement TM1.");
    });
});

// ---------- Cancel ----------
$(document).on("click", ".tm1-cancel-btn", function(e) {
    e.preventDefault();
    removeEditRows();
});



// ------------------------------- Helpers ------------------------------------------
function removeTM2EditRows() {
    $(".tm2-edit-row").remove();
}

// Crée le formulaire inline TM2
function createTM2EditRow(record = {}, mode = "update") {
    // mode: "update" | "insert"
    const id = record.option_detail_id || "";
    const description = record.description || "";
    const status = (record.subscription_status || "Active");
    const value = record.subscription_value != null ? record.subscription_value : "";
    const paymentType = record.payment_type || "Cash";
    const amount = record.amount != null ? record.amount : "";
    const tax = record.tax_rate != null ? record.tax_rate : "";
    const invoiceNb = record.InvoiceNb_id || "";

    // colspan = number of columns in the original TM2 table
    const colspan = $(".tm2-table thead tr th").length;

    const $edit = $(`
        <tr class="tm2-edit-row">
            <td colspan="${colspan}">
                <div class="tm2-edit-form" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                    <div>
                        <label style="font-size:12px">ID (readonly)</label><br>
                        <input type="text" name="option_detail_id" class="form-control form-control-sm tm2-id" value="${id}" readonly>
                    </div>

                    <div>
                        <label style="font-size:12px">Description</label><br>
                        <input type="text" name="description" class="form-control form-control-sm tm2-description" value="${description}">
                    </div>

                    <div>
                        <label style="font-size:12px">Status</label><br>
                        <select class="form-control form-control-sm tm2-status">
                            <option value="Active" ${status === "Active" ? "selected" : ""}>Active</option>
                            <option value="Inactive" ${status === "Inactive" ? "selected" : ""}>Inactive</option>
                        </select>
                    </div>

                    <div>
                        <label style="font-size:12px">Value</label><br>
                        <input type="number" step="1" class="form-control form-control-sm tm2-value" value="${value}">
                    </div>

                    <div>
                        <label style="font-size:12px">Payment Type</label><br>
                        <select class="form-control form-control-sm tm2-payment-type">
                            <option value="Cash" ${paymentType === "Cash" ? "selected" : ""}>Cash</option>
                            <option value="Card" ${paymentType === "Card" ? "selected" : ""}>Card</option>
                            <option value="Transfer" ${paymentType === "Transfer" ? "selected" : ""}>Transfer</option>
                        </select>
                    </div>

                    <div>
                        <label style="font-size:12px">Amount</label><br>
                        <input type="number" step="0.01" class="form-control form-control-sm tm2-amount" value="${amount}">
                    </div>

                    <div>
                        <label style="font-size:12px">Tax (%)</label><br>
                        <input type="number" step="0.01" class="form-control form-control-sm tm2-tax" value="${tax}">
                    </div>

                    <div>
                        <label style="font-size:12px">Invoice Nb</label><br>
                        <input type="text" class="form-control form-control-sm tm2-invoice" value="${invoiceNb}">
                    </div>

                    <div style="display:flex;flex-direction:column;gap:6px;margin-left:8px;">
                        <button class="btn btn-success btn-sm tm2-save-btn">${mode === "insert" ? "Insert" : "Save"}</button>
                        <button class="btn btn-secondary btn-sm tm2-cancel-btn">Cancel</button>
                        ${mode === "update" ? '<button class="btn btn-danger btn-sm tm2-delete-btn">Delete</button>' : ''}
                    </div>
                </div>
            </td>
        </tr>
    `);

    return $edit;
}

// ------------------------- Triggers Insert / Update / Delete --------------------------
$(document).on("click", ".tm2-table .insert-btn, .tm2-table .update-btn, .tm2-table .delete-btn", function(e) {
    e.preventDefault();
    const $btn = $(this);
    const $row = $btn.closest("tr");
    const record = $row.data("record") || {};

    removeTM2EditRows();

    if ($btn.hasClass("delete-btn")) {
        const id = record.option_detail_id;
        if (!id) return alert("Impossible de supprimer : ID manquant.");
        if (!confirm("Confirmer la suppression ?")) return;
        $.post("/deleteTM2", { id: id })
            .done(function() { $row.remove(); })
            .fail(function() { alert("Erreur lors de la suppression TM2."); });
        return;
    }

    const mode = $btn.hasClass("insert-btn") ? "insert" : "update";
    const $editRow = createTM2EditRow(mode === "update" ? record : {}, mode);
    $row.after($editRow);
});

// ---------- Save (Insert / Update) ----------
$(document).on("click", ".tm2-save-btn", function(e) {
    e.preventDefault();
    const $btn = $(this);
    const $editRow = $btn.closest("tr");
    const $form = $editRow.find(".tm2-edit-form");
    const $originalRow = $editRow.prev();
    const originalRecord = $originalRow.data("record") || {};

    // Collect values
    const option_detail_id = $form.find(".tm2-id").val();
    const description = $form.find(".tm2-description").val();
    const subscription_status = $form.find(".tm2-status").val();
    const subscription_value = $form.find(".tm2-value").val();
    const payment_type = $form.find(".tm2-payment-type").val();
    const amount = $form.find(".tm2-amount").val();
    const tax_rate = $form.find(".tm2-tax").val();
    const InvoiceNb_id = $form.find(".tm2-invoice").val();

    // Build payload
    const payload = {
        option_detail_id: option_detail_id,
        description: description,
        subscription_status: subscription_status,
        subscription_value: subscription_value,
        payment_type: payment_type,
        amount: amount,
        tax_rate: tax_rate,
        InvoiceNb_id: InvoiceNb_id
    };

    // Determine endpoint
    const isInsert = !option_detail_id || option_detail_id === "";
    const url = isInsert ? "/insertTM2" : "/updateTM2";

    $.ajax({
        url: url,
        method: "POST",
        data: payload,
        dataType: "json"
    }).done(function(res) {
        const saved = res || {};

        if (isInsert) {
            // create new row same format as renderTM2
            const $newRow = $("<tr>").data("record", saved);
            $newRow.append($("<td>").text(saved.description || ""));
            $newRow.append($("<td>").text(saved.subscription_status || ""));
            $newRow.append($("<td>").text(saved.subscription_value || ""));
            $newRow.append($("<td>").text(saved.payment_type || ""));
            $newRow.append($("<td>").text(saved.amount || ""));
            $newRow.append($("<td>").text(saved.tax_rate || ""));
            $newRow.append($("<td>").text(saved.InvoiceNb_id || ""));
            const actionTd = $("<td>");
            actionTd.append(
                $('<button class="btn btn-success btn-sm me-1 insert-btn">Insert</button>'),
                $('<button class="btn btn-warning btn-sm me-1 update-btn">Update</button>'),
                $('<button class="btn btn-danger btn-sm delete-btn">Delete</button>')
            );
            $newRow.append(actionTd);
            // append after the original row (for insert we used the row where Insert was clicked)
            $originalRow.after($newRow);
        } else {
            // Update UI: update original row cells and data-record
            $originalRow.data("record", saved);
            const $cells = $originalRow.children("td");
            // Assuming columns order in renderTM2: description, status, value, payment type, amount, tax, invoice, actions
            $cells.eq(0).text(saved.description || "");
            $cells.eq(1).text(saved.subscription_status || "");
            $cells.eq(2).text(saved.subscription_value || "");
            $cells.eq(3).text(saved.payment_type || "");
            $cells.eq(4).text(saved.amount || "");
            $cells.eq(5).text(saved.tax_rate || "");
            $cells.eq(6).text(saved.InvoiceNb_id || "");
        }

        removeTM2EditRows();
    }).fail(function() {
        alert("Erreur lors de l'enregistrement TM2.");
    });
});

// ---------- Cancel ----------
$(document).on("click", ".tm2-cancel-btn", function(e) {
    e.preventDefault();
    removeTM2EditRows();
});


function setModulePermissions(userRole) {
    // TM1
    if(userRole === "admin") {
        // admin peut tout sur TM1
        $(".tm1-table .insert-btn, .tm1-table .update-btn, .tm1-table .delete-btn").prop("disabled", false);
    } else {
        // client n'a rien sur TM1
        $(".tm1-table .insert-btn, .tm1-table .update-btn, .tm1-table .delete-btn").prop("disabled", true);
    }

    // TM2
    if(userRole === "client") {
        // client peut tout sur TM2
        $(".tm2-table .insert-btn, .tm2-table .update-btn, .tm2-table .delete-btn").prop("disabled", false);
    } else {
        // admin n'a rien sur TM2
        $(".tm2-table .insert-btn, .tm2-table .update-btn, .tm2-table .delete-btn").prop("disabled", true);
    }
}

// Exemple d'appel
$(document).ready(function(){
    const userRole = window.CURRENT_USER_ROLE.toLowerCase(); // "admin" ou "client"
    setModulePermissions(userRole);
});


//-------------------getSession -------------------------
function getSession(userId, username, email, role, adminText) {
    // --- Durée de session : 20 minutes ---
    const sessionDurationMs = 20 * 60 * 1000; // 20 minutes en millisecondes
    const expiry = Date.now() + sessionDurationMs;

    // --- Stockage dans sessionStorage ---
    sessionStorage.setItem("CURRENT_USER_ID", userId);
    sessionStorage.setItem("CURRENT_USERNAME", username);
    sessionStorage.setItem("CURRENT_EMAIL", email);
    sessionStorage.setItem("CURRENT_USER_ROLE", role);
    sessionStorage.setItem("CURRENT_ADMIN_TEXT", adminText);
    sessionStorage.setItem("SESSION_EXPIRES", expiry);

    // --- Variables globales ---
    window.CURRENT_USER_ID = userId;
    window.CURRENT_USER_ROLE = role;

    // --- Création d’un cookie temporaire ---
    document.cookie = `TEMP_USER=${username}; path=/; max-age=${20*60}; SameSite=Lax`;

    console.log("🔄 Session initialized with 20 min expiry", {
        userId, username, email, role, adminText
    });

    // --- Planifier suppression automatique de la session ---
    setTimeout(() => {
        logoutSession();
    }, sessionDurationMs);
}

//-----------------logoutSession -------------------------
function logoutSession() {
    window.CURRENT_USER_ID = null;
    window.CURRENT_USER_ROLE = null;
    sessionStorage.removeItem("CURRENT_USER_ID");
    sessionStorage.removeItem("CURRENT_USER_ROLE");

    $.post("/logout", {}, function(res){
        console.log(res.message || "Session closed");
        window.location.href = "/login";
    });
}

// dashboard.js (après récupération des infos de session)
const currentUserData = {
    id: window.CURRENT_USER_ID,
    username: "{{ session.get('username','') }}",
    email: "{{ session.get('email','') }}",
    role: "{{ session.get('role','') }}",
    fname: "{{ session.get('fname','') }}",
    lname: "{{ session.get('lname','') }}"
};
 

});// fin DOM
  
