// Apps Script para receber treinos do app e gravar no Google Sheets
// Gerado automaticamente. Substitua os valores se necessario.
const SHEET_ID = '1-BiJ1RL3BPkIkZAAHbOchcUxjMA_Zm2ewvnIj83snko';
const SHEET_NAME = 'Sheet1';

function ensureHeader(sheet) {
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id','createdAt','date','type','workoutName','notes','exercise','sets','reps','load']);
  }
}

function openSheetByName(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function doPost(e) {
  try {
    const payload = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const ss = SpreadsheetApp.openById(SHEET_ID);
    if (!ss) return ContentService.createTextOutput(JSON.stringify({ok:false, error:'Spreadsheet not found'})).setMimeType(ContentService.MimeType.JSON);
    const sheet = openSheetByName(ss, SHEET_NAME);
    ensureHeader(sheet);

    if (payload.action === 'save' && Array.isArray(payload.workouts)) {
      const rows = [];
      payload.workouts.forEach(w => {
        (w.exercises || []).forEach(ex => {
          rows.push([w.id, w.createdAt, w.date, w.type, w.name, w.notes || '', ex.name || '', ex.sets || 0, ex.reps || 0, ex.load || 0]);
        });
      });
      if (rows.length) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      }
      return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'load') {
      const values = sheet.getDataRange().getValues();
      const rows = values.slice(1);
      const map = {};
      rows.forEach(r => {
        const [id, createdAt, date, type, workoutName, notes, exercise, sets, reps, load] = r;
        if (!id) return;
        if (!map[id]) map[id] = { id: String(id), createdAt: String(createdAt), date: String(date), type: String(type), name: String(workoutName), notes: String(notes || ''), exercises: [] };
        map[id].exercises.push({ name: String(exercise || ''), sets: Number(sets || 0), reps: Number(reps || 0), load: Number(load || 0) });
      });
      const workouts = Object.values(map).sort((a,b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
      return ContentService.createTextOutput(JSON.stringify({ok:true, workouts})).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ok:false, error:'acao desconhecida'})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false, error: String(err)})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    return ContentService.createTextOutput(JSON.stringify({ok:true, sheetExists: !!sheet})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false, error:String(err)})).setMimeType(ContentService.MimeType.JSON);
  }

}

// Nota: nao execute apenas `ensureHeader()` no editor — use `doGet()` para testar.
