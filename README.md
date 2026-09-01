# Treinos

Aplicativo web estatico para registrar treinos, feito para publicar no GitHub Pages e instalar no iPhone pelo Safari.

## Publicar no GitHub Pages

1. Crie um repositorio no GitHub.
2. Envie a pasta `treino-app` para o repositorio.
3. No GitHub, abra `Settings > Pages`.
4. Em `Build and deployment`, escolha `Deploy from a branch`.
5. Selecione a branch principal e a pasta `/root`.

Se o repositorio tiver outros arquivos, voce tambem pode publicar somente esta pasta usando uma branch separada ou movendo os arquivos de `treino-app` para a raiz do repositorio.

## Instalar no iPhone

1. Abra a URL do GitHub Pages no Safari.
2. Toque no botao de compartilhar.
3. Escolha `Adicionar a Tela de Inicio`.

Os dados ficam salvos no proprio aparelho via `localStorage`. Use o botao de exportar para fazer backup em JSON.

## Salvar no Google Sheets (Apps Script)

Se voce quiser manter os registros online em um Google Sheets, pode usar um pequeno *web app* do Google Apps Script que recebe os treinos e grava linhas na planilha.

Passos rápidos:

1. Crie uma planilha no Google Sheets e anote o ID na URL (a parte entre `/d/` e `/edit`).
2. No menu da planilha, abra `Extensões > Apps Script` e crie um novo script.
3. Cole o código abaixo no editor e substitua `SHEET_ID` e `SHEET_NAME` pelos valores da sua planilha.
4. Salve e escolha `Deploy > New deployment` → `Web app`.
	 - Execute como: `Me` (sua conta)
	 - Quem tem acesso: `Anyone` (ou `Anyone, even anonymous` se disponível)
5. Copie a URL do deploy e cole em `Configurar` no app (botao de engrenagem).

Apps Script (cole no editor do Apps Script):

```javascript
// Substitua pelas suas configurações
const SHEET_ID = 'SHEET_ID_HERE';
const SHEET_NAME = 'Sheet1';

function ensureHeader(sheet) {
	if (sheet.getLastRow() === 0) {
		sheet.appendRow(['id','createdAt','date','type','workoutName','notes','exercise','sets','reps','load']);
	}
}

function doPost(e) {
	try {
		const payload = JSON.parse(e.postData.contents || '{}');
		const ss = SpreadsheetApp.openById(SHEET_ID);
		const sheet = ss.getSheetByName(SHEET_NAME);
		if (!sheet) return ContentService.createTextOutput(JSON.stringify({ok:false, error:'Sheet not found'})).setMimeType(ContentService.MimeType.JSON);
		ensureHeader(sheet);

		if (payload.action === 'save' && Array.isArray(payload.workouts)) {
			const rows = [];
			payload.workouts.forEach(w => {
				(w.exercises || []).forEach(ex => {
					rows.push([w.id, w.createdAt, w.date, w.type, w.name, w.notes || '', ex.name || '', ex.sets || 0, ex.reps || 0, ex.load || 0]);
				});
			});
			if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
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
```

Observações:

- O script grava cada exercício como uma linha separada (uma linha = um exercício em um treino). Ele também implementa `action: 'load'` retornando os treinos lidos da planilha, assim o app pode sincronizar o histórico.
- Se preferir segurança extra, restrinja o acesso do web app a `Only myself` e implemente OAuth no cliente (mais complexo).

Depois de colar a URL no app, clique em `Sincronizar` para carregar os treinos existentes (se houver) e testar o salvamento automático quando você salvar novos treinos.

Se quiser, eu posso gerar o arquivo do Apps Script pronto para colar — quer que eu gere isso agora?

## URL do Web App (deploy)

O app já foi configurado para usar um Web App do Google Apps Script. A URL atual do Web App é:

https://script.google.com/macros/s/AKfycbx4P2pES1r7r7onQ_r0Qk_OPD796mqsNRUOcEejExDy5BLzVgKYvAqyUsRyAynkrA/exec

Observações rápidas:
- O botão `Configurar` foi removido: o app usa esta URL por padrão e tenta sincronizar automaticamente ao abrir.
- Se quiser usar outra URL, edite `app.js` (variável `DEFAULT_API_URL`) ou limpe o `localStorage` do app.

Comandos de teste (substitua a URL acima se mudar):

Health check (GET):
```bash
curl 'https://script.google.com/macros/s/AKfycbx4P2pES1r7r7onQ_r0Qk_OPD796mqsNRUOcEejExDy5BLzVgKYvAqyUsRyAynkrA/exec'
```

Salvar um treino de exemplo (POST):
```bash
curl -X POST 'https://script.google.com/macros/s/AKfycbx4P2pES1r7r7onQ_r0Qk_OPD796mqsNRUOcEejExDy5BLzVgKYvAqyUsRyAynkrA/exec' \
	-H 'Content-Type: application/json' \
	-d '{"action":"save","workouts":[{"id":"t1","createdAt":"2026-08-31T00:00:00Z","date":"2026-08-31","type":"Musculacao","name":"Teste","notes":"ok","exercises":[{"name":"Supino","sets":3,"reps":8,"load":60}]}]}'
```

Se precisar que eu substitua essa URL por outra, ou que eu coloque instruções mais detalhadas em [README.md](README.md), me avise.
