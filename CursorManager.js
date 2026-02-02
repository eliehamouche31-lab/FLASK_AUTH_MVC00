// ============================
// CursorManager Singleton
// ============================
(function(global){
  const pages = {};
  const listeners = [];

  function init(pageId){
    if(!pages[pageId]){
      pages[pageId] = {
        cursor: null,
        mode: 'view',   // view | edit | add
        rows: []        // ordered list of row IDs
      };
    }
  }

  function registerRow(pageId, rowId){
    const p = pages[pageId];
    if(!p) return;
    rowId = String(rowId);
    if(!p.rows.includes(rowId)) p.rows.push(rowId);
    if(!p.cursor) p.cursor = rowId;
    notify(pageId);
  }

  function setCursor(pageId,rowId){
    const p = pages[pageId];
    if(!p || !p.rows.includes(String(rowId))) return;
    p.cursor = String(rowId);
    p.mode = 'view';
    notify(pageId);
  }

  function intent(pageId, action){
    const p = pages[pageId];
    if(!p || !p.cursor) return;

    if(action==='edit') p.mode='edit';
    else if(action==='add') p.mode='add';
    else if(action==='cancel' || action==='view') p.mode='view';

    notify(pageId);
  }

  function moveCursorUp(pageId){
    const p = pages[pageId];
    if(!p || p.rows.length===0) return;
    const i = p.rows.indexOf(p.cursor);
    if(i>0){ p.cursor=p.rows[i-1]; notify(pageId); }
  }

  function moveCursorDown(pageId){
    const p = pages[pageId];
    if(!p || p.rows.length===0) return;
    const i = p.rows.indexOf(p.cursor);
    if(i<p.rows.length-1){ p.cursor=p.rows[i+1]; notify(pageId); }
  }

  function deleteRow(pageId){
    const p = pages[pageId];
    if(!p || !p.cursor) return;
    const idx = p.rows.indexOf(p.cursor);
    p.rows.splice(idx,1);
    if(p.rows.length===0) p.cursor=null;
    else if(idx<p.rows.length) p.cursor=p.rows[idx];
    else p.cursor=p.rows[p.rows.length-1];
    p.mode='view';
    notify(pageId);
  }

  function addRow(pageId){
    const p = pages[pageId];
    if(!p) return;
    const newId = `__new__${Date.now()}`;
    p.rows.push(newId);
    p.cursor=newId;
    p.mode='add';
    notify(pageId);
    return newId;
  }

  function getState(pageId){
    const p = pages[pageId];
    if(!p) return null;
    return {
      cursorRowId: p.cursor,
      mode: p.mode,
      rows: [...p.rows]
    };
  }

  function onChange(fn){ listeners.push(fn); }

  function notify(pageId){
    const state = getState(pageId);
    listeners.forEach(fn=>fn(pageId,state));
  }

  global.CursorManager = {
    init,
    registerRow,
    setCursor,
    intent,
    moveCursorUp,
    moveCursorDown,
    deleteRow,
    addRow,
    getState,
    onChange
  };

})(window);