/* =========================
   CURSOR CLASS (STATIC)
========================= */
class Cursor {
  static row = null;
  static activeCell = null;
  static colIndex = null;

  static attachToRow($row) {
    this.row = $row;
    this.clear();
    this.focusFirstCell();
    this.bindEvents();
  }

  static focusFirstCell() {
    const $firstEditable = this.row
      .find("td")
      .has("input:not([disabled]), select:not([disabled])")
      .first();
    this.focusCell($firstEditable);
  }

  static focusCell($td) {
    if (!$td || !$td.length) return;

    $(".active-cell").removeClass("active-cell");
    this.activeCell = $td;
    this.colIndex = $td.index();
    $td.addClass("active-cell");

    const $input = $td.find("input,select");
    if ($input.length) {
      $input.focus();
      $input.select();
    }
  }

  static bindEvents() {
    $(document)
      .off(".cursor")
      .on("keydown.cursor", "td input, td select", this.handleKeydown.bind(this))
      .on("click.cursor", "td input, td select", function() {
        Cursor.focusCell($(this).closest("td"));
      });
  }

  static handleKeydown(e) {
    if (!this.activeCell) return;

    const $td = this.activeCell;
    const $row = this.row;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        this.focusCell($td.nextAll("td").has("input,select").first());
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.focusCell($td.prevAll("td").has("input,select").first());
        break;
      case "ArrowDown":
        e.preventDefault();
        this.focusSameColumn($row.next("tr"));
        break;
      case "ArrowUp":
        e.preventDefault();
        this.focusSameColumn($row.prev("tr"));
        break;
      case "Escape":
        e.preventDefault();
        Demo.cancelRowEdit($row);
        break;
      case "Enter":
        e.preventDefault();
        Demo.saveRowEdit($row);
        break;
    }
  }

  static focusSameColumn($targetRow) {
    if (!$targetRow || !$targetRow.length) return;
    const $td = $targetRow.children("td").eq(this.colIndex);
    if ($td.find("input,select").length) this.focusCell($td);
  }

  static detach() {
    $(document).off(".cursor");
    this.clear();
    this.row = null;
  }

  static clear() {
    $(".active-cell").removeClass("active-cell");
    this.activeCell = null;
    this.colIndex = null;
  }
}
