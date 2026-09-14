# Crolina
Sistema de inteligência documental: upload até 500 MB, extração de PDF/DOCX/TXT/MD/CSV/XLSX/XLS/JSON/PPTX/PNG/JPG/WEBP, OCR, resumo, pontos importantes/interessantes, tópicos, apresentação, índice, desenvolvimento, resolução e exportação PDF/DOCX/TXT até 500 MB.

## Rodar
cp backend/.env.example backend/.env
npm install
npm run dev

Para IA configure GEMINI_API_KEY. Sem chave, existe análise de fallback local.


## IA

O Crolina usa o Google Gemini 2.5 Flash-Lite para análise documental. Configure `GEMINI_API_KEY` no backend. O modelo pode ser alterado com `GEMINI_MODEL`. Sem uma chave Gemini, o sistema utiliza o analisador local de fallback.
