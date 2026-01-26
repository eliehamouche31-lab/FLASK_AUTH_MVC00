class MagicUI {

// ------------------ Magic Table ------------------
  
static magiqueTable(data, containerId, includeActions = true) {
        MagicUI.magicTable(data, containerId, includeActions); // delegate to new method
}

static  magicTable(data, containerId, includeActions = true) {
    const container = document.getElementById(containerId);
    if (!data || !data.length) {
        container.innerHTML = "<p class='text-center text-muted mt-3'>⚠️ No data available.</p>";
        return;
    }

    let html = `<table class="magic-table">
        <thead>
            <tr>
                ${Object.keys(data[0]).map(k => `<th>${k}</th>`).join("")}
                ${includeActions ? "<th>Actions</th>" : ""}
            </tr>
        </thead>
        <tbody>`;

    data.forEach(row => {
        html += "<tr>";
        Object.entries(row).forEach(([k, v]) => {
            if ((k === 'image' || k === 'icon_path') && v) {
                html += `<td><img src="/dashboard/${v}" alt="${k}" style="width:60px;height:60px;object-fit:cover;border-radius:6px"/></td>`;
            } else if (k === 'image' || k === 'icon_path') {
                html += "<td>❌</td>";
            } else {
                html += `<td>${v}</td>`;
            }
        });

        if (includeActions) {
            const id = row.id || row.service_option_id || row.option_detail_id;
            html += `<td>
                        <button class="magic-btn btn-details" data-id="${id}">🔍 Details</button>
                        <button class="magic-btn btn-edit" data-id="${id}">✏ Edit</button>
                        <button class="magic-btn btn-delete" data-id="${id}">🗑 Delete</button>
                     </td>`;
        }

        html += "</tr>";
    });

    html += "</tbody></table>";

    // Render table
    container.innerHTML = html;

    if (!includeActions) return; // Pas de boutons → pas de binding

    // -------------------- 🔹 Bind Events for Actions --------------------
    const $container = $(container);

    $container.find(".btn-details").off("click").on("click", function () {
        const id = $(this).data("id");
        console.log("🟦 Triggered TM1 → TM2 for ID:", id);
        if (typeof loadTM2 === "function") loadTM2(id);
    });

    $container.find(".btn-edit").off("click").on("click", async function () {
        const id = $(this).data("id");
        const desc = prompt("📝 Enter new description:");
        if (!desc) return;

        try {
            await fetch(`/dashboard/zone4/edit/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: desc })
            });
            alert("Description updated successfully.");
            if (typeof loadTM1 === "function") loadTM1(id);
        } catch (err) {
            console.error("❌ Edit failed:", err);
            alert("Failed to update description.");
        }
    });

    $container.find(".btn-delete").off("click").on("click", async function () {
        const id = $(this).data("id");
        if (!confirm("⚠️ Are you sure you want to delete this option?")) return;

        try {
            await fetch(`/dashboard/zone4/delete/${id}`, { method: 'POST' });
            alert("Option deleted successfully.");
            if (typeof loadTM1 === "function") loadTM1(id);
        } catch (err) {
            console.error("❌ Delete failed:", err);
            alert("Failed to delete option.");
        }
    });
}
 
    // ------------------ Popup Magic ------------------
    static popupMagic(content, options = {}) {
        const title = options.title || "Information";
        const width = options.width || "400px";
        const height = options.height || "auto";
        const $popup = $(`
            <div class="magic-popup-overlay">
                <div class="magic-popup" style="width:${width};height:${height}">
                    <div class="magic-popup-header">
                        <span>${title}</span>
                        <button class="magic-popup-close">&times;</button>
                    </div>
                    <div class="magic-popup-body">${content}</div>
                </div>
            </div>
        `);

        $("body").append($popup);
        $popup.fadeIn(200);

        // Close button
        $popup.find(".magic-popup-close").on("click", () => {
            $popup.fadeOut(200, () => $popup.remove());
        });

        // Close on click outside
        $popup.on("click", e => {
            if ($(e.target).hasClass("magic-popup-overlay")) {
                $popup.fadeOut(200, () => $popup.remove());
            }
        });
    }

    // ------------------ Render Magic Table ------------------
    static table(data, options = {}) {
        const container = $(options.container || "#zone4");
        const columns = options.columns || (data.length ? Object.keys(data[0]) : []);
        const includeActions = options.actions && options.actions.length > 0;
        const callbacks = options.callbacks || {};

        if (!data || !data.length) {
            container.html("<p>⚠️ No data to display.</p>");
            return;
        }

        let html = `<table class="magic-table"><thead><tr>`;
        columns.forEach(c => html += `<th>${c}</th>`);
        if (includeActions) html += `<th>Actions</th>`;
        html += `</tr></thead><tbody>`;

        data.forEach(row => {
            html += `<tr>`;
            columns.forEach(col => {
                if (col === "image" || col === "icon_path") {
                    html += `<td><img src="${row[col]}" alt="${col}" style="max-width:40px;max-height:40px"/></td>`;
                } else {
                    html += `<td>${row[col]}</td>`;
                }
            });

            if (includeActions) {
                const id = row.id || row.service_option_id || row.detail_id || row.payid;
                html += `<td>
                            ${options.actions.includes("details") ? `<button class="magic-btn btn-details" data-id="${id}">Details</button>` : ""}
                            ${options.actions.includes("edit") ? `<button class="magic-btn btn-edit" data-id="${id}">Edit</button>` : ""}
                            ${options.actions.includes("delete") ? `<button class="magic-btn btn-delete" data-id="${id}">Delete</button>` : ""}
                         </td>`;
            }

            html += `</tr>`;
        });

        html += `</tbody></table>`;

        container.stop(true,true).fadeOut(100, function() {
            $(this).html(html).fadeIn(200);
        });

        // ---------------- Bind action buttons ----------------
        container.off("click", ".btn-details").on("click", ".btn-details", function() {
            const id = $(this).data("id");
            callbacks.details?.(id);
        });

        container.off("click", ".btn-edit").on("click", ".btn-edit", function() {
            const id = $(this).data("id");
            callbacks.edit?.(id);
        });

        container.off("click", ".btn-delete").on("click", ".btn-delete", function() {
            const id = $(this).data("id");
            callbacks.delete?.(id);
        });
    }

    // ------------------ Popup function ------------------
    static popup(content, options = {}) {
        const title = options.title || "Info";
        const $popup = $(`<div class="magic-popup"><h3>${title}</h3><div>${content}</div></div>`);
        $("body").append($popup);
        $popup.fadeIn(200);

        // Close on click outside
        $(document).on("click.magicPopup", e => {
            if (!$(e.target).closest(".magic-popup").length) {
                $popup.fadeOut(200, () => $popup.remove());
                $(document).off("click.magicPopup");
            }
        });
    }

    // ------------------ Search + table render ------------------
    static async search(query = "", entity = "all") {
        try {
            const res = await fetch(`/dashboard/zone4/${entity}?query=${encodeURIComponent(query)}`);
            if(!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            if(!data.length) {
                $("#zone4").html("<p>⚠️ No results found.</p>");
                return;
            }

            // Columns mapping
            let columns = [];
            switch(entity) {
                    case "users":
                        columns = ["id", "username", "email", "fname", "lname", "datebirth", "role"];
                        break;
                    case "services":
                        columns = ["id", "service_name", "icon_path", "created_date", "checked"];
                        break;
                    case "options":
                        columns = ["id", "option_name", "link", "image", "checked_option"];
                        break;
                    case "option_detail":
                        columns = ["id", "description", "subscription_status", "subscription_value", "payment_type", "created_at"];
                        break;
                    case "payment":
                        columns = ["id", "amount", "currency", "payment_method", "payment_status", "pay_date", "created_at"];
                        break;
                    default:
                        columns = data.length ? Object.keys(data[0]) : [];
                }

            MagicUI.table(data, {
                container: "#zone4",
                columns: columns,
                actions: ["details","edit","delete"],
                callbacks: {
                    details: id => MagicUI.popup(`<p>Details for ID ${id}</p>`),
                    edit: async id => {
                        const newVal = prompt("Enter new value:");
                        if(!newVal) return;
                        await fetch(`/dashboard/zone4/edit/${id}`, {
                            method:'POST',
                            headers:{'Content-Type':'application/json'},
                            body: JSON.stringify({ value: newVal })
                        });
                        MagicUI.search(query, entity);
                    },
                    delete: async id => {
                        if(!confirm("Delete this item?")) return;
                        await fetch(`/dashboard/zone4/delete/${id}`, { method:'POST' });
                        MagicUI.search(query, entity);
                    }
                }
            });

        } catch(err) {
            console.error(err);
            $("#zone4").html("<p>⚠️ Error loading data.</p>");
        }
    }
 
    
}
 