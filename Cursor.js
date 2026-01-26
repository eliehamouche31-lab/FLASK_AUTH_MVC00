// class cursorManager  
 
class CursorManager {
    constructor(tableSelector) {
        this.table = document.querySelector(tableSelector);
        this.rows = Array.from(this.table.querySelectorAll("tbody tr"));
        this.currentRowIndex = null;

        this.listeners = {}; // for custom events like "cursorChange"
        this.initKeyboardNavigation();
    }

    // ------------------ CURSOR MANAGEMENT ------------------
    setCursor(index) {
        if (index < 0 || index >= this.rows.length) return;

        this.clearCursor();
        this.currentRowIndex = index;
        this.rows[index].classList.add("active-cursor");

        this.emit("cursorChange", this.currentRowData());
    }

    clearCursor() {
        if (this.currentRowIndex !== null) {
            this.rows[this.currentRowIndex].classList.remove("active-cursor");
        }
    }

    next() {
        if (this.currentRowIndex === null) this.setCursor(0);
        else if (this.currentRowIndex < this.rows.length - 1) this.setCursor(this.currentRowIndex + 1);
    }

    previous() {
        if (this.currentRowIndex === null) this.setCursor(0);
        else if (this.currentRowIndex > 0) this.setCursor(this.currentRowIndex - 1);
    }

    currentRowData() {
        if (this.currentRowIndex === null) return null;
        const cells = this.rows[this.currentRowIndex].querySelectorAll("td");
        return Array.from(cells).map(cell => cell.innerText);
    }

    currentRowElement() {
        return this.currentRowIndex !== null ? this.rows[this.currentRowIndex] : null;
    }

    refreshRows() {
        this.rows = Array.from(this.table.querySelectorAll("tbody tr"));
    }

    // ------------------ KEYBOARD NAVIGATION ------------------
    initKeyboardNavigation() {
        document.addEventListener("keydown", (e) => {
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    this.next();
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    this.previous();
                    break;
                case "Enter":
                    e.preventDefault();
                    this.emit("editRow", this.currentRowData());
                    break;
            }
        });
    }

    // ------------------ EVENT SYSTEM ------------------
    on(eventName, callback) {
        if (!this.listeners[eventName]) this.listeners[eventName] = [];
        this.listeners[eventName].push(callback);
    }

    emit(eventName, payload) {
        if (!this.listeners[eventName]) return;
        this.listeners[eventName].forEach(cb => cb(payload));
    }

    // ------------------ TRIGGER INTEGRATION ------------------
    bindTriggers({updateBtn, deleteBtn, cancelBtn, addBtn}) {
        if (updateBtn) {
            updateBtn.addEventListener("click", () => {
                const rowData = this.currentRowData();
                if (!rowData) return alert("Select a row first!");
                this.emit("updateRow", {index: this.currentRowIndex, data: rowData});
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener("click", () => {
                const rowData = this.currentRowData();
                if (!rowData) return alert("Select a row first!");
                this.emit("deleteRow", {index: this.currentRowIndex, data: rowData});
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                const rowData = this.currentRowData();
                if (!rowData) return;
                this.emit("cancelRow", {index: this.currentRowIndex, data: rowData});
            });
        }

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                this.emit("addRow");
                setTimeout(() => {
                    this.refreshRows();
                    this.setCursor(this.rows.length - 1); // focus new row
                }, 50);
            });
        }
    }
}
