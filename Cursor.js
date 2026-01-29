 
// =================================================
// CursorManager.js (simplified robust version) 2026
// =================================================
class CursorManager {
    static _pages = {};
    static _listeners = {};
    static _cursors = {};

 // initilaization 
    static init(pageId, tableId, tbodySelector) {
        const tbody = document.querySelector(tbodySelector);
        if (!tbody) return;

        const rowsById = new Map();
        const order = [];

        tbody.querySelectorAll("tr").forEach(tr => {
            const rowId = tr.dataset.id;
            if (!rowId) return;
            rowsById.set(String(rowId), tr);
            order.push(String(rowId));
        });

        CursorManager._pages[pageId] = {
            pageId,
            tableId,
            tbody,
            rowsById,
            order,
            columns: Array.from(tbody.querySelectorAll('td')).map(td => td.dataset.key || td.cellIndex),
            cursorRowId: null,
            mode: "view",
            originalRow: null,
        };

        console.log(`CursorManager initialized for page: ${pageId}`);
    }

    //-------------cursor navigation----------
    static setCursor(pageId, rowId) {
        const p = CursorManager._pages[pageId];
        if (!p || !p.rowsById || !p.order) return;
        if (!p.rowsById.has(String(rowId))) return;

        p.cursorRowId = String(rowId);
        CursorManager._cursors[pageId] = String(rowId);

        p.rowsById.forEach(tr => tr.classList.remove('cursor'));
        const row = p.rowsById.get(String(rowId));
        if (row) row.classList.add('cursor');
    }

    static getCursor(pageId) {
        return CursorManager._cursors[pageId] || null;
    }

    static moveCursorUp(pageId) {
        const p = CursorManager._pages[pageId];
        if (!p || !p.order || !p.order.length) return;
        const keys = p.order;
        let idx = keys.indexOf(p.cursorRowId);
        if (idx === -1) idx = keys.length;
        this.setCursor(pageId, keys[(idx - 1 + keys.length) % keys.length]);
    }

    static moveCursorDown(pageId) {
        const p = CursorManager._pages[pageId];
        if (!p || !p.order || !p.order.length) return;
        const keys = p.order;
        let idx = keys.indexOf(p.cursorRowId);
        if (idx === -1) idx = -1;
        this.setCursor(pageId, keys[(idx + 1) % keys.length]);
    }

    static previousRow(pageId) {
        CursorManager.moveCursorUp(pageId);
    }
    static nextRow(pageId) {
        CursorManager.moveCursorDown(pageId);
    }

//-------------- CRUD fucntions-----------------------------
    static beginEdit(pageId, rowId) {
        const p = CursorManager._pages[pageId];
        if (!p || !p.rowsById) return;
        const row = p.rowsById.get(String(rowId));
        if (!row) return;

        p.cursorRowId = String(rowId);
        CursorManager._cursors[pageId] = String(rowId);
        p.mode = "edit";

        p.rowsById.forEach(tr => tr.classList.remove('cursor'));
        row.classList.add('cursor');

        const editableCells = Array.from(row.querySelectorAll("td.editable"));
        editableCells.forEach(td => {
            td.dataset.original = td.innerText;
            td.innerHTML = `<input type="text" value="${td.innerText}">`;
        });

        if (editableCells.length > 0) {
            editableCells[0].querySelector('input').focus();
        }
    }

    static cancelEdit(pageId, rowId) {
        const p = CursorManager._pages[pageId];
        if (!p || !p.rowsById) return;
        const row = p.rowsById.get(String(rowId));
        if (!row) return;
        row.querySelectorAll("td.editable").forEach(td => {
            td.innerText = td.dataset.original ?? "";
            delete td.dataset.original;
        });
        p.mode = "view";
    }

    static commitEdit(pageId, rowId, newData = {}) {
        const p = CursorManager._pages[pageId];
        if (!p || !p.rowsById) return;
        const row = p.rowsById.get(String(rowId));
        if (!row) return;
        row.querySelectorAll("td.editable").forEach(td => {
            const key = td.dataset.key;
            if (key in newData) td.innerText = newData[key];
            delete td.dataset.original;
        });
        p.mode = "view";
    }


    static beginAdd(pageId) {
    const p = CursorManager._pages[pageId];
    if (!p) return;
    // Ne pas autoriser plusieurs insertions
    if (p.mode === "insert") return;
    p.mode = "insert";
    // ID temporaire côté client
    const rowId = `new-${Date.now()}`;
    // Création de la ligne
    const tr = document.createElement("tr");
    tr.dataset.id = rowId;
    tr.classList.add("cursor");
    tr.innerHTML = `
        <td class="editable"></td>
        <td class="editable"></td>
        <td class="editable"></td>
        <td>
            <button class="update-btn">Update</button>
            <button class="delete-btn">Delete</button>
        </td>
    `;

    //// Added AFTER the last line (Excel-like)
    p.tbody.appendChild(tr);

    // Mise à jour de l’état interne
    p.rowsById.set(rowId, tr);
    p.order.push(rowId);
    p.cursorRowId = rowId;
    CursorManager._cursors[pageId] = rowId;

    // Nettoyage ancien curseur
    p.rowsById.forEach(r => {
        if (r !== tr) r.classList.remove("cursor");
    });

    // Passage immédiat en édition
    tr.querySelectorAll("td.editable").forEach(td => {
        td.dataset.original = "";
        td.innerHTML = `<input type="text" value="">`;
    });

    // Focus première colonne
    const firstInput = tr.querySelector("td.editable input");
    firstInput?.focus();
   }

  static beginDelete(pageId, rowId) {
    const p = CursorManager._pages[pageId];
    if (!p || !p.rowsById) return;

    p.mode = "delete";   // ← missing
    console.log("Delete Confirm:", rowId);
}

static beginDelete_(pageId, rowId) {
    CursorManager.deleteRow(pageId, rowId);
}

static deleteAtCursor(pageId) {
    const p = CursorManager._pages[pageId];
    if (!p || !p.cursorRowId) return;
    CursorManager.deleteRow(pageId, p.cursorRowId);
}


   static deleteRow(pageId, rowId) {
    const p = CursorManager._pages[pageId];
    if (!p || !p.rowsById) return;
    const id = String(rowId);
    const row = p.rowsById.get(id);
    if (!row) return;
    const idx = p.order.indexOf(id);
    // Remove DOM + state
    row.remove();
    p.rowsById.delete(id);
    p.order.splice(idx, 1);
    // Determine new cursor target
    let newCursor = null;
    if (p.order.length > 0) {
        newCursor =
            p.order[idx] ??          // next row
            p.order[idx - 1] ??      // previous row
            null;
    }
    p.cursorRowId = newCursor;
    CursorManager._cursors[pageId] = newCursor;
    // Update highlight
    p.rowsById.forEach(tr => tr.classList.remove('cursor'));
    if (newCursor && p.rowsById.has(newCursor)) {
        p.rowsById.get(newCursor).classList.add('cursor');
    }
  }
 
static cancelPageAction(pageId) {
    const p = CursorManager._pages[pageId];
    if (!p) return;

    const rowId = p.cursorRowId;

    if (p.mode === "edit") {
        CursorManager.cancelEdit(pageId, rowId);
    }

    if (p.mode === "insert") {
        if (rowId) CursorManager.deleteRow(pageId, rowId);
    }

    p.mode = "view";
}
 

    static syncRows(pageId) {
        const p = CursorManager._pages[pageId];
        if (!p) return;
        const rowsById = new Map();
        const order = [];
        p.tbody.querySelectorAll("tr").forEach(tr => {
            const rowId = tr.dataset.id;
            if (!rowId) return;
            rowsById.set(String(rowId), tr);
            order.push(String(rowId));
        });
        p.rowsById = rowsById;
        p.order = order;
        if (!p.cursorRowId || !rowsById.has(p.cursorRowId)) p.cursorRowId = order[0] ?? null;
    }

    //------- navigation position of cursor---------------
    static getFirstRowId(pageId) {
        const p = CursorManager._pages[pageId];
        return p?.order?.[0] ?? null;
    }

    static getLastRowId(pageId) {
        const p = CursorManager._pages[pageId];
        return p?.order?.[p.order.length - 1] ?? null;
    }

    static getNextRowId(pageId, currentRowId) {
        const p = CursorManager._pages[pageId];
        if (!p || !p.order) return null;
        const idx = p.order.indexOf(String(currentRowId));
        return idx >= 0 && idx < p.order.length - 1 ? p.order[idx + 1] : null;
    }
}
 


